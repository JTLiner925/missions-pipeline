// Missions Pipeline API: the only thing that talks to Notion.
// The phone app calls this function; the Notion secret never leaves the server.
//
// Secrets (Supabase → Edge Functions → Secrets):
//   NOTION_TOKEN   the Internal Integration Secret from the workspace owner

const NOTION = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";
const TOKEN = Deno.env.get("NOTION_TOKEN") ?? "";
const TZ = "America/Chicago";

// Database IDs under the MISSIONS PIPELINE page. Not secret.
const DB = {
  team: "9908d67a5ca04ea98662d8330e929fef",
  people: "b23ccad150c44ed686ba6093f53e884c",
  meetings: "0ba7cc43b2204b32a7477ec0854abaf2",
  involvement: "485453a7ae4e47a1a1c475527259efb5",
};

const STAGES = [
  "New Contact",
  "Disco Scheduled",
  "Engaging Discover",
  "Committed (Develop — ICT)",
  "Engaging (Post — ICT)",
  "Committed-Long Term (12-18 mo out)",
  "Launched to field!",
  "Returned from the field",
  "Exited ICT",
  "Offramp",
];
const PRE_DISCO = ["New Contact", "Disco Scheduled"];
// Where someone lands once their discovery meeting is logged.
const AFTER_DISCO = "Engaging Discover";
// Readiness lights the app may set. "\u23F8\uFE0F" is the pause icon (stalled).
const APP_READINESS = ["🟢", "🟡", "\u23F8\uFE0F", "🔴", "✈️"];
const SESSION_DAYS = 90;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-session, authorization, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

// ---------- Notion helpers ----------

async function notion(path: string, method = "GET", body?: unknown) {
  const res = await fetch(NOTION + path, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("Notion error", res.status, JSON.stringify(data));
    throw new HttpError(502, data?.message ?? "Notion did not accept the request.");
  }
  return data;
}

async function query(db: string, body: Record<string, unknown>, max = 100) {
  const out: any[] = [];
  let cursor: string | undefined;
  do {
    const page = await notion(`/databases/${db}/query`, "POST", {
      page_size: Math.min(100, max - out.length),
      ...body,
      ...(cursor ? { start_cursor: cursor } : {}),
    });
    out.push(...page.results);
    cursor = page.has_more ? page.next_cursor : undefined;
  } while (cursor && out.length < max);
  return out;
}

const plain = (rt: any[] | undefined) => (rt ?? []).map((t) => t.plain_text).join("");
const P = {
  title: (p: any, n: string) => plain(p.properties[n]?.title),
  text: (p: any, n: string) => plain(p.properties[n]?.rich_text),
  select: (p: any, n: string) => p.properties[n]?.select?.name ?? "",
  multi: (p: any, n: string) => (p.properties[n]?.multi_select ?? []).map((o: any) => o.name),
  date: (p: any, n: string) => p.properties[n]?.date?.start ?? "",
  rel: (p: any, n: string) => (p.properties[n]?.relation ?? []).map((r: any) => r.id),
  check: (p: any, n: string) => !!p.properties[n]?.checkbox,
  phone: (p: any, n: string) => p.properties[n]?.phone_number ?? "",
  email: (p: any, n: string) => p.properties[n]?.email ?? "",
  rollupDate: (p: any, n: string) => p.properties[n]?.rollup?.date?.start ?? "",
};

const W = {
  title: (s: string) => ({ title: [{ text: { content: s.slice(0, 200) } }] }),
  // Notion caps one rich-text item at 2000 characters, so long notes are split.
  text: (s: string) => ({
    rich_text: (s.match(/[\s\S]{1,1900}/g) ?? []).map((c) => ({ text: { content: c } })),
  }),
  select: (s: string) => ({ select: s ? { name: s } : null }),
  multi: (a: string[]) => ({ multi_select: a.map((name) => ({ name })) }),
  date: (s: string) => ({ date: s ? { start: s } : null }),
  rel: (ids: string[]) => ({ relation: ids.map((id) => ({ id })) }),
  check: (b: boolean) => ({ checkbox: !!b }),
};

const clean = (id: string) => id.replace(/-/g, "");
const str = (v: unknown, max = 4000) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const isId = (s: unknown) => typeof s === "string" && /^[0-9a-f-]{32,36}$/i.test(s);

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

// ---------- Sessions ----------
// A signed token, so no session table is needed. The signing key is derived
// from the Notion secret; rotating that secret signs everyone out.

const enc = new TextEncoder();
async function hmac(message: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode("missions-pipeline-session:" + TOKEN),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function makeSession(id: string) {
  const payload = `${clean(id)}.${Date.now() + SESSION_DAYS * 86400000}`;
  return `${payload}.${await hmac(payload)}`;
}

type Member = {
  id: string;
  name: string;
  role: string;
  active: boolean;
  code: string;
  failures: number;
  lockedUntil: string;
};

async function loadTeam(): Promise<Member[]> {
  const rows = await query(DB.team, {});
  return rows.map((r) => ({
    id: clean(r.id),
    name: P.title(r, "Name"),
    role: P.select(r, "Role"),
    active: P.check(r, "Active"),
    code: P.text(r, "App Code").trim(),
    failures: r.properties["Failed Sign-ins"]?.number ?? 0,
    lockedUntil: P.date(r, "Locked Until"),
  }));
}

async function requireUser(req: Request, team: Member[]) {
  const token = req.headers.get("x-session") ?? "";
  const [id, exp, sig] = token.split(".");
  if (!id || !exp || !sig) throw new HttpError(401, "Please sign in.");
  if ((await hmac(`${id}.${exp}`)) !== sig || Number(exp) < Date.now()) {
    throw new HttpError(401, "Please sign in again.");
  }
  // Checked against Notion on every request, so unticking Active removes access at once.
  const me = team.find((m) => m.id === id && m.active);
  if (!me) throw new HttpError(401, "Your access has been turned off.");
  return me;
}

const isStaff = (m: Member) => m.role === "Missions Team";

// ---------- Shaping data for the app ----------

function names(ids: string[], team: Member[]) {
  return ids.map((id) => team.find((m) => m.id === clean(id))?.name).filter(Boolean) as string[];
}

function personSummary(p: any, team: Member[]) {
  const owners = P.rel(p, "Owner");
  return {
    id: clean(p.id),
    name: P.title(p, "Full Name"),
    stage: P.select(p, "Stage"),
    readiness: P.select(p, "Readiness"),
    owners: names(owners, team),
    ownerIds: owners.map(clean),
    nextStep: P.text(p, "Next Step"),
    followUpBy: P.date(p, "Follow Up By"),
    discoDate: P.date(p, "Disco Date"),
    lastContact: P.rollupDate(p, "Last Contact"),
    added: (p.created_time ?? "").slice(0, 10),
  };
}

function meetingSummary(m: any, team: Member[]) {
  return {
    id: clean(m.id),
    type: P.select(m, "Type"),
    date: P.date(m, "Date"),
    metBy: names(P.rel(m, "Met By"), team),
    notes: P.text(m, "Notes"),
    story: P.text(m, "Meeting Notes"),
    interest: P.text(m, "Missions Interest"),
    prayer: P.text(m, "Prayer"),
    nextStep: P.text(m, "Next Step"),
    followUpBy: P.date(m, "Follow Up By"),
  };
}

const owns = (me: Member, p: any) => P.rel(p, "Owner").map(clean).includes(me.id);

// Emoji can be stored with or without an invisible "variation selector", so the
// light is matched against the options that exist in Notion rather than sent as
// typed. That keeps the app from creating a look-alike duplicate option.
const bare = (s: string) => s.replace(/\uFE0F/g, "");
async function readinessOption(wanted: unknown): Promise<string | null> {
  if (typeof wanted !== "string" || !APP_READINESS.map(bare).includes(bare(wanted))) return null;
  const db = await notion(`/databases/${DB.people}`);
  const options: any[] = db.properties?.["Readiness"]?.select?.options ?? [];
  return options.find((o) => bare(o.name) === bare(wanted))?.name ?? null;
}

async function discoInfo(personId: string, team: Member[]) {
  const rows = await query(DB.meetings, {
    filter: {
      and: [
        { property: "Person", relation: { contains: personId } },
        { property: "Type", select: { equals: "Disco" } },
      ],
    },
    sorts: [{ property: "Date", direction: "ascending" }],
  }, 1);
  if (!rows.length) return null;
  return { date: P.date(rows[0], "Date"), by: names(P.rel(rows[0], "Met By"), team) };
}

// ---------- Actions ----------

async function actTeam(team: Member[]) {
  return { team: team.filter((m) => m.active).map((m) => ({ id: m.id, name: m.name })) };
}

// Sign-in lockout. Every 5th wrong code in a row locks that name: 15 minutes the
// first time, doubling each time after, up to a day. The count and lock live on
// the Team row in Notion, so they survive restarts and the team can clear them.
const TRIES_PER_LOCK = 5;
const FIRST_LOCK_MIN = 15;
const MAX_LOCK_MIN = 24 * 60;
// One check per name at a time on this instance, so a burst of parallel guesses
// cannot all slip in before the count is saved.
const signingIn = new Set<string>();

const minutesLeft = (until: string) => Math.ceil((Date.parse(until) - Date.now()) / 60000);

function lockedError(until: string) {
  const mins = minutesLeft(until);
  const wait = mins >= 90 ? `${Math.round(mins / 60)} hours` : `${mins} minute${mins === 1 ? "" : "s"}`;
  return new HttpError(429, `Too many wrong codes. Try again in ${wait}, or ask the missions team to unlock you.`);
}

async function saveSignInState(member: Member, failures: number, lockedUntil: string) {
  await notion(`/pages/${member.id}`, "PATCH", {
    properties: {
      "Failed Sign-ins": { number: failures || null },
      "Locked Until": W.date(lockedUntil),
    },
  });
}

async function actLogin(body: any, team: Member[]) {
  const member = team.find((m) => m.id === clean(str(body.teamId, 40)) && m.active);
  const code = str(body.code, 20);
  if (!member || !member.code) {
    await new Promise((r) => setTimeout(r, 800));
    throw new HttpError(401, "That name and code do not match.");
  }
  if (member.lockedUntil && minutesLeft(member.lockedUntil) > 0) throw lockedError(member.lockedUntil);
  if (signingIn.has(member.id)) throw new HttpError(429, "One moment, then try again.");

  signingIn.add(member.id);
  try {
    if (member.code !== code) {
      const failures = member.failures + 1;
      let lockedUntil = "";
      if (failures % TRIES_PER_LOCK === 0) {
        const mins = Math.min(FIRST_LOCK_MIN * 2 ** (failures / TRIES_PER_LOCK - 1), MAX_LOCK_MIN);
        lockedUntil = new Date(Date.now() + mins * 60000).toISOString();
      }
      await saveSignInState(member, failures, lockedUntil);
      await new Promise((r) => setTimeout(r, 800)); // slows down guessing
      if (lockedUntil) throw lockedError(lockedUntil);
      throw new HttpError(401, "That name and code do not match.");
    }
    if (member.failures || member.lockedUntil) await saveSignInState(member, 0, "");
  } finally {
    signingIn.delete(member.id);
  }
  return {
    token: await makeSession(member.id),
    me: { id: member.id, name: member.name, role: member.role },
  };
}

async function actHome(me: Member, team: Member[]) {
  const t = today();
  const mine = { property: "Owner", relation: { contains: me.id } };
  const monthStart = t.slice(0, 8) + "01";

  const [followUps, monthMeetings, overdue] = await Promise.all([
    query(DB.people, {
      filter: { and: [mine, { property: "Follow Up By", date: { is_not_empty: true } }] },
      sorts: [{ property: "Follow Up By", direction: "ascending" }],
    }, 50),
    query(DB.meetings, {
      filter: {
        and: [
          { property: "Date", date: { on_or_after: monthStart } },
          ...(isStaff(me) ? [] : [{ property: "Met By", relation: { contains: me.id } }]),
        ],
      },
    }, 300),
    query(DB.people, {
      filter: {
        and: [
          { property: "Follow Up By", date: { before: t } },
          ...(isStaff(me) ? [] : [mine]),
        ],
      },
    }, 300),
  ]);

  return {
    me: { id: me.id, name: me.name, role: me.role },
    today: t,
    followUps: followUps.map((p) => personSummary(p, team)),
    stats: {
      scope: isStaff(me) ? "team" : "you",
      discos: monthMeetings.filter((m) => P.select(m, "Type") === "Disco").length,
      followUps: monthMeetings.filter((m) => P.select(m, "Type") === "Follow-up").length,
      overdue: overdue.length,
    },
  };
}

async function actOptions(me: Member, team: Member[]) {
  const open = await query(DB.involvement, {
    filter: { property: "Open for sign-up", checkbox: { equals: true } },
    sorts: [{ property: "Dates", direction: "descending" }],
  }, 20);
  return {
    team: team.filter((m) => m.active).map((m) => ({ id: m.id, name: m.name })),
    stages: STAGES,
    involvement: open.map((i) => ({ id: clean(i.id), name: P.title(i, "Name") })),
    canPickOwner: isStaff(me),
  };
}

// Everyone signed in can search the whole pipeline by name. Volunteer leaders
// get the disco status and owner of people who are not theirs, and nothing else.
async function actSearch(body: any, me: Member, team: Member[]) {
  const q = str(body.q, 80);
  if (q.length < 2) return { results: [] };
  const rows = await query(DB.people, {
    filter: { property: "Full Name", title: { contains: q } },
    sorts: [{ property: "Full Name", direction: "ascending" }],
  }, 12);

  const results = await Promise.all(rows.map(async (p) => {
    const s = personSummary(p, team);
    const full = isStaff(me) || owns(me, p);
    const disco = s.discoDate ? await discoInfo(s.id, team) : null;
    const base = {
      id: s.id,
      name: s.name,
      owners: s.owners,
      mine: owns(me, p),
      canOpen: full,
      discoDate: disco?.date || s.discoDate,
      discoBy: disco?.by ?? [],
      added: s.added,
    };
    return full ? { ...s, ...base } : base;
  }));
  return { results };
}

async function loadPersonFor(me: Member, id: string) {
  if (!isId(id)) throw new HttpError(400, "Pick a person first.");
  const p = await notion(`/pages/${clean(id)}`);
  if (clean(p.parent?.database_id ?? "") !== DB.people || p.archived || p.in_trash) {
    throw new HttpError(404, "That person is no longer in the pipeline.");
  }
  if (!isStaff(me) && !owns(me, p)) {
    throw new HttpError(403, "Only the missions team and this person's owner can open their notes.");
  }
  return p;
}

async function actPerson(body: any, me: Member, team: Member[]) {
  const p = await loadPersonFor(me, str(body.id, 40));
  const [meetings, involvement] = await Promise.all([
    query(DB.meetings, {
      filter: { property: "Person", relation: { contains: clean(p.id) } },
      sorts: [{ property: "Date", direction: "descending" }],
    }, 25),
    query(DB.involvement, {
      filter: { property: "Participants", relation: { contains: clean(p.id) } },
      sorts: [{ property: "Dates", direction: "descending" }],
    }, 25),
  ]);
  return {
    person: {
      ...personSummary(p, team),
      phone: P.phone(p, "Phone"),
      email: P.email(p, "Email"),
      interests: P.text(p, "Interests"),
      howWeMet: P.select(p, "How We Met"),
      potentialNextSteps: P.multi(p, "Potential Next Steps"),
      story: P.text(p, "Meeting Notes"),
      prayer: P.text(p, "Prayer"),
      notionUrl: p.url,
    },
    meetings: meetings.map((m) => meetingSummary(m, team)),
    involvement: involvement.map((i) => ({
      name: P.title(i, "Name"),
      type: P.select(i, "Type"),
      date: P.date(i, "Dates"),
    })),
  };
}

async function actAddContact(body: any, me: Member, team: Member[]) {
  const name = str(body.name, 120);
  if (!name) throw new HttpError(400, "Add a name.");

  let ownerId = me.id;
  if (isStaff(me) && isId(body.ownerId)) {
    const picked = team.find((m) => m.id === clean(body.ownerId) && m.active);
    if (picked) ownerId = picked.id;
  }

  const props: Record<string, unknown> = {
    "Full Name": W.title(name),
    "Stage": W.select("New Contact"),
    "Readiness": W.select("🟢"),
    "Owner": W.rel([ownerId]),
  };
  const phone = str(body.phone, 40);
  const email = str(body.email, 120);
  if (phone) props["Phone"] = { phone_number: phone };
  if (email) props["Email"] = { email };
  if (["Male", "Female"].includes(body.gender)) props["Gender"] = W.select(body.gender);
  if (["Sunday", "Missions Class", "Referral", "Trip", "Event", "Other"].includes(body.howWeMet)) {
    props["How We Met"] = W.select(body.howWeMet);
  }
  if (["Single", "Engaged", "Married", "Divorced", "Widowed"].includes(body.marital)) {
    props["Marital Status"] = W.select(body.marital);
  }
  if (["Yes", "No"].includes(body.kids)) props["Kids?"] = W.select(body.kids);
  const kidsDetail = str(body.kidsDetail, 300);
  if (kidsDetail) props["Kids (name and age)"] = W.text(kidsDetail);
  const interests = str(body.interests, 500);
  if (interests) props["Interests"] = W.text(interests);
  if (body.college === true) props["College?"] = W.check(true);
  if (body.ethnicMinority === true) props["Ethnic Minority"] = W.check(true);

  const page = await notion("/pages", "POST", {
    parent: { database_id: DB.people },
    properties: props,
  });
  return { person: personSummary(page, team) };
}

async function actAddMeeting(body: any, me: Member, team: Member[]) {
  const type = body.type === "Disco" ? "Disco" : body.type === "Follow-up" ? "Follow-up" : "";
  if (!type) throw new HttpError(400, "Unknown meeting type.");
  const p = await loadPersonFor(me, str(body.personId, 40));
  const personId = clean(p.id);
  const personName = P.title(p, "Full Name");

  const date = isDate(body.date) ? body.date : today();
  const followUpBy = isDate(body.followUpBy) ? body.followUpBy : "";
  const nextStep = str(body.nextStep, 500);
  const metBy = (Array.isArray(body.metBy) ? body.metBy : [])
    .filter(isId)
    .map(clean)
    .filter((id: string) => team.some((m) => m.id === id && m.active));
  if (!metBy.includes(me.id) && metBy.length === 0) metBy.push(me.id);

  const notes = str(body.notes, 6000);
  const story = str(body.story, 6000);
  const interest = str(body.interest, 3000);
  const prayer = str(body.prayer, 3000);

  const mProps: Record<string, unknown> = {
    "Meeting": W.title(`${type} · ${personName} · ${date}`),
    "Type": W.select(type),
    "Date": W.date(date),
    "Person": W.rel([personId]),
    "Met By": W.rel(metBy),
    "Source": W.select("App"),
  };
  if (notes) mProps["Notes"] = W.text(notes);
  if (story) mProps["Meeting Notes"] = W.text(story);
  if (interest) mProps["Missions Interest"] = W.text(interest);
  if (prayer) mProps["Prayer"] = W.text(prayer);
  if (nextStep) mProps["Next Step"] = W.text(nextStep);
  if (followUpBy) mProps["Follow Up By"] = W.date(followUpBy);
  if (type === "Follow-up" && ["Yes", "Not yet"].includes(body.lastStepDone)) {
    mProps["Last Step Done?"] = W.select(body.lastStepDone);
  }

  const meeting = await notion("/pages", "POST", {
    parent: { database_id: DB.meetings },
    properties: mProps,
  });

  // Keep the person's row current so the Notion views and digest stay right.
  const pProps: Record<string, unknown> = {
    "Next Step": W.text(nextStep),
    "Follow Up By": W.date(followUpBy),
  };
  const currentStage = P.select(p, "Stage");
  if (type === "Disco") {
    if (!P.date(p, "Disco Date")) pProps["Disco Date"] = W.date(date);
    if (!currentStage || PRE_DISCO.includes(currentStage)) pProps["Stage"] = W.select(AFTER_DISCO);
    if (story) pProps["Meeting Notes"] = W.text(story);
    if (interest) pProps["Interests"] = W.text(interest);
  }
  if (prayer) pProps["Prayer"] = W.text(prayer);
  if (typeof body.stage === "string" && STAGES.includes(body.stage) && body.stage !== currentStage) {
    pProps["Stage"] = W.select(body.stage);
    if (body.stage === "Offramp") pProps["Readiness"] = W.select("🚪");
  }
  if (pProps["Readiness"] === undefined) {
    const light = await readinessOption(body.readiness);
    if (light) pProps["Readiness"] = W.select(light);
  }
  if (Array.isArray(body.potentialNextSteps) && body.potentialNextSteps.length) {
    const allowed = ["Missions Class", "STT", "DMC", "ICT", "Vision Trip"];
    const merged = new Set([
      ...P.multi(p, "Potential Next Steps"),
      ...body.potentialNextSteps.filter((s: unknown) => allowed.includes(s as string)),
    ]);
    pProps["Potential Next Steps"] = W.multi([...merged]);
  }
  if (Array.isArray(body.involvementIds) && body.involvementIds.length) {
    const merged = new Set([
      ...P.rel(p, "Involvement").map(clean),
      ...body.involvementIds.filter(isId).map(clean),
    ]);
    pProps["Involvement"] = W.rel([...merged]);
  }

  await notion(`/pages/${personId}`, "PATCH", { properties: pProps });
  return { ok: true, meetingId: clean(meeting.id), personName };
}

// ---------- Entry point ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);
  if (!TOKEN) return json({ error: "The app is not connected to Notion yet." }, 503);

  try {
    const body = await req.json().catch(() => ({}));
    const action = str(body.action, 40);
    const team = await loadTeam();

    if (action === "team") return json(await actTeam(team));
    if (action === "login") return json(await actLogin(body, team));

    const me = await requireUser(req, team);
    switch (action) {
      case "home":
        return json(await actHome(me, team));
      case "options":
        return json(await actOptions(me, team));
      case "search":
        return json(await actSearch(body, me, team));
      case "person":
        return json(await actPerson(body, me, team));
      case "addContact":
        return json(await actAddContact(body, me, team));
      case "addMeeting":
        return json(await actAddMeeting(body, me, team));
      default:
        return json({ error: "Unknown action." }, 400);
    }
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: "Something went wrong. Try again." }, 500);
  }
});
