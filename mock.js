// Demo data used only when API_URL in config.js is empty.
// Every person here is made up. Nothing is saved.

const iso = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const team = [
  { id: 't1', name: 'Sample Staff', role: 'Missions Team' },
  { id: 't2', name: 'Sample Volunteer', role: 'Volunteer Leader' },
  { id: 't3', name: 'Other Staff', role: 'Missions Team' },
];

const people = [
  { id: 'p1', name: 'Hannah Reyes', stage: 'Disco Done', readiness: '🟢', ownerIds: ['t1'], nextStep: 'Send Missions Class sign-up', followUpBy: iso(-3), discoDate: iso(-17), added: iso(-30) },
  { id: 'p2', name: 'Mia Thompson', stage: 'Engaging Discover', readiness: '🟡', ownerIds: ['t1'], nextStep: 'Check in', followUpBy: iso(5), discoDate: iso(-90), added: iso(-120) },
  { id: 'p3', name: 'Elena Cruz', stage: 'New Contact', readiness: '🟢', ownerIds: ['t1'], nextStep: 'Schedule her disco meeting', followUpBy: iso(8), discoDate: '', added: iso(-4) },
  { id: 'p4', name: 'Daniel Okafor', stage: 'Disco Done', readiness: '🟢', ownerIds: ['t3'], nextStep: 'Invite to Nation\'s Prayer', followUpBy: iso(-6), discoDate: iso(-20), added: iso(-40) },
  { id: 'p5', name: 'Abby Lin', stage: 'Disco Scheduled', readiness: '🟢', ownerIds: ['t2'], nextStep: 'Disco meeting', followUpBy: iso(5), discoDate: '', added: iso(-10) },
];

const meetings = [
  { id: 'm1', personId: 'p1', type: 'Disco', date: iso(-17), metBy: ['t1'], notes: '', story: 'Grew up in church, came alive in college.', interest: 'Unsure yet, drawn to prayer ministry.', prayer: 'Clarity on next steps.', nextStep: 'Send Missions Class sign-up', followUpBy: iso(-3) },
  { id: 'm2', personId: 'p4', type: 'Disco', date: iso(-20), metBy: ['t3'], notes: '', story: 'Business owner.', interest: 'Business as mission, West Africa.', prayer: '', nextStep: 'Invite to Nation\'s Prayer', followUpBy: iso(-6) },
  { id: 'm3', personId: 'p2', type: 'Disco', date: iso(-90), metBy: ['t1'], notes: '', story: 'Nurse.', interest: 'South Asia.', prayer: '', nextStep: 'Check in', followUpBy: iso(5) },
];

const names = (ids) => ids.map((id) => team.find((t) => t.id === id)?.name).filter(Boolean);
const lastContact = (id) => meetings.filter((m) => m.personId === id).map((m) => m.date).sort().pop() || '';
const summary = (p) => ({ ...p, owners: names(p.ownerIds), lastContact: lastContact(p.id) });

export async function mockApi(action, body, session) {
  await new Promise((r) => setTimeout(r, 150));
  const me = team.find((t) => t.id === session?.me?.id);
  const staff = me?.role === 'Missions Team';
  const canOpen = (p) => staff || p.ownerIds.includes(me?.id);

  switch (action) {
    case 'team':
      return { team: team.map(({ id, name }) => ({ id, name })) };
    case 'login': {
      const m = team.find((t) => t.id === body.teamId);
      if (!m || !body.code) throw new Error('That name and code do not match.');
      return { token: 'demo', me: m };
    }
    case 'home': {
      const today = iso(0);
      const mine = people.filter((p) => p.ownerIds.includes(me.id));
      const scope = staff ? people : mine;
      const month = today.slice(0, 7);
      const ms = meetings.filter((m) => m.date.startsWith(month) && (staff || m.metBy.includes(me.id)));
      return {
        me, today,
        followUps: mine.filter((p) => p.followUpBy).sort((a, b) => a.followUpBy.localeCompare(b.followUpBy)).map(summary),
        stats: {
          scope: staff ? 'team' : 'you',
          discos: ms.filter((m) => m.type === 'Disco').length,
          followUps: ms.filter((m) => m.type === 'Follow-up').length,
          overdue: scope.filter((p) => p.followUpBy && p.followUpBy < today).length,
        },
      };
    }
    case 'options':
      return {
        team: team.map(({ id, name }) => ({ id, name })),
        stages: ['New Contact', 'Disco Scheduled', 'Disco Done', 'Engaging Discover', 'Committed (Develop — ICT)', 'Engaging (Post — ICT)', 'Committed-Long Term (12-18 mo out)', 'Launched to field!', 'Returned from the field', 'Exited ICT', 'Offramp'],
        involvement: [{ id: 'i1', name: 'Living Sent · Fall 2026' }, { id: 'i2', name: 'DMC · Fall 2026' }],
        canPickOwner: staff,
      };
    case 'search': {
      const q = (body.q || '').toLowerCase();
      return {
        results: people.filter((p) => p.name.toLowerCase().includes(q)).map((p) => {
          const disco = meetings.find((m) => m.personId === p.id && m.type === 'Disco');
          const base = { id: p.id, name: p.name, owners: names(p.ownerIds), mine: p.ownerIds.includes(me.id), canOpen: canOpen(p), discoDate: p.discoDate, discoBy: disco ? names(disco.metBy) : [], added: p.added };
          return canOpen(p) ? { ...summary(p), ...base } : base;
        }),
      };
    }
    case 'person': {
      const p = people.find((x) => x.id === body.id);
      if (!p) throw new Error('That person is no longer in the pipeline.');
      if (!canOpen(p)) throw new Error('Only the missions team and this person\'s owner can open their notes.');
      return {
        person: { ...summary(p), phone: '(512) 555-0142', email: 'sample@example.com', interests: 'South Asia', howWeMet: 'Sunday', potentialNextSteps: ['Missions Class'], story: '', prayer: '', notionUrl: '' },
        meetings: meetings.filter((m) => m.personId === p.id).sort((a, b) => b.date.localeCompare(a.date)).map((m) => ({ ...m, metBy: names(m.metBy) })),
        involvement: p.id === 'p2' ? [{ name: 'DMC · Spring 2026', type: 'Training', date: iso(-200) }] : [],
      };
    }
    case 'addContact': {
      const p = { id: 'p' + (people.length + 1), name: body.name, stage: 'New Contact', readiness: '🟢', ownerIds: [staff && body.ownerId ? body.ownerId : me.id], nextStep: '', followUpBy: '', discoDate: '', added: iso(0) };
      people.push(p);
      return { person: summary(p) };
    }
    case 'addMeeting': {
      const p = people.find((x) => x.id === body.personId);
      meetings.push({ id: 'm' + (meetings.length + 1), personId: p.id, type: body.type, date: body.date, metBy: body.metBy, notes: body.notes, story: body.story, interest: body.interest, prayer: body.prayer, nextStep: body.nextStep, followUpBy: body.followUpBy });
      p.nextStep = body.nextStep; p.followUpBy = body.followUpBy;
      if (body.readiness) p.readiness = body.readiness;
      if (body.type === 'Disco') { p.discoDate = p.discoDate || body.date; if (['New Contact', 'Disco Scheduled'].includes(p.stage)) p.stage = 'Disco Done'; }
      if (body.stage && body.stage !== p.stage && body.type !== 'Disco') p.stage = body.stage;
      return { ok: true, personName: p.name };
    }
    default:
      throw new Error('Unknown action.');
  }
}
