// Content for the Disco Guide page (#/guide). Adapted from the mobilization
// team's Discover Meeting Outline for The Well. Plain HTML; no user data.

export const HUB_URL = 'https://jtliner925.github.io/missions-hub/';

// Follow-up texts. [Name] and [your name] are left for the sender to fill in.
export const TEXTS = [
  {
    group: 'First reach-out',
    items: [
      "Hey [Name]! This is [your name] from The Well's missions team. It's exciting to hear you're interested in missions! I'd love to meet you, hear your story, and share what we do. When's a good time to get together?",
      "Hey [Name]! This is [your name] from The Well's missions team. [Friend] gave me your number and said you'd be interested in hearing more about missions. I'd love to meet you, get to know you, and share more. Let me know when you're free next week and we can set something up :)",
    ],
  },
  {
    group: 'Second text',
    items: [
      "Hey [Name], I hope you're having a good week! I wanted to circle back on your interest in missions at The Well. I'd love to get together, share what we do, and hear how we can serve you. Do you have time to meet up next week?",
      "Hey [Name], just checking in to see if you saw my text! Would you be up for meeting and hearing more about missions at The Well? Let me know! :)",
    ],
  },
  {
    group: 'Third and last text',
    items: [
      "Just checking in one more time to see if you'd like to get together and hear more about missions at The Well! If I don't hear from you, feel free to reach out anytime. ☺️",
      "Just checking in once more to see if you'd like to get together and catch up on what God is doing in your life. If I don't hear from you, feel free to reach out anytime. ☺️",
      "Hey [Name]! This is [your name] from The Well's missions team. Checking in one last time to see if you'd like to meet and catch up. I'd love to keep looping you in on ways to learn more about missions and disciple-making, but I don't want to be annoying, so let me know if you're not interested! Hope you're doing well 🙂",
    ],
  },
  {
    group: "Someone you haven't talked to in a while",
    items: [
      "Hey [Name], this is [your name] from The Well's missions team. It's been a while since we've been in touch, so I wanted to check in. I'd love to keep you in the loop on ways to learn more about missions and disciple-making (Missions Class is starting again soon!), but I don't want to be annoying, so let me know if you're not interested. Hope you're doing well 🙂",
    ],
  },
  {
    group: 'Someone passed on from another teammate',
    items: [
      "Hi [Name], this is [your name] from The Well's missions team. [Teammate] and I met you a while ago and I wanted to reach out since it's been so long. We have disciple-making communities starting soon and some nations events coming up. Are you still interested in hearing about these? I'm happy to keep you in the loop, but I don't want to send things that aren't relevant to you, so let me know. Hope you're doing well!",
    ],
  },
  {
    group: 'Not ready for a DMC right now',
    items: [
      "Hey [Name], this is [your name] from The Well's missions team. I hope you're doing well! I wanted to check in and see how we can best serve you outside of a DMC right now. Let me know if you'd like to meet and we can set up a time 🙂",
    ],
  },
];

export const GUIDE_HTML = `
<p class="small muted">A simple flow for a discovery meeting. Use what fits the person in front of you; it's a conversation, not a script.</p>

<div class="card pad stack">
  <div class="eyebrow">Remember W.H.O.</div>
  <p><b>W</b>ho are they?</p>
  <p><b>H</b>ow much do they know about missions and the nations?</p>
  <p><b>O</b>pportunities they can step into</p>
</div>

<details class="more" open>
  <summary>Start with a roadmap</summary>
  <div class="stack-lg small">
    <p>Tell them where the time is going: <i>"I'd love to get to know you a bit, then share more about missions at The Well, and then talk about [what they asked about]."</i></p>
    <p><b>Take notes.</b> It helps the conversation flow and helps you remember later. Log the meeting in this app afterwards.</p>
  </div>
</details>

<details class="more">
  <summary>1. Who are they?</summary>
  <div class="stack-lg small">
    <div class="stack"><b>Background</b>
      <ul class="guide-list">
        <li>"Tell me a little about you."</li>
        <li>How did you end up in Austin? How long have you been here?</li>
        <li>What do you do for work?</li>
      </ul></div>
    <div class="stack"><b>Spiritual journey</b>
      <ul class="guide-list">
        <li>"I'd love to hear how you started following Jesus."</li>
        <li>Follow their thread: "You mentioned your dad was in the military. How did that shape your faith growing up?"</li>
        <li>What are you passionate about? What part of ministry gets you excited?</li>
        <li>Celebrate what God is already doing in them.</li>
      </ul></div>
    <div class="stack"><b>Connection to The Well</b>
      <ul class="guide-list">
        <li>"How did you get connected to The Well?"</li>
        <li>"How long have you been part of that community or serving there?"</li>
        <li>If they're from another Launch Global church, speak in a way that honors their church.</li>
      </ul></div>
  </div>
</details>

<details class="more">
  <summary>2. How much do they know?</summary>
  <div class="stack-lg small">
    <ul class="guide-list">
      <li>"What has your exposure to missions been, if any?"</li>
      <li>"Have you ever been overseas?"</li>
      <li>"What made you want to meet with someone from the missions team?"</li>
      <li>"How did God give you a heart for the nations?"</li>
      <li>"Have you ever considered going overseas long-term?"</li>
    </ul>
    <div class="stack"><b>Share the vision</b>
      <p>"I'd love to share the story of missions at The Well, why we have the vision we do, and how we train people." Talk about how the heart to send came about, who we've sent, and how we train. Use the scripture and stats that have moved <i>you</i>.</p></div>
    <div class="stack"><b>Scripture: missions from Genesis to Revelation</b>
      <ul class="guide-list">
        <li>The Bible guides what we do, and we see God's heart for the nations all through it.</li>
        <li>Genesis: God made people to worship Him and told them to be fruitful and multiply. They did. There are now billions of people, but not all of them are worshiping.</li>
        <li>Revelation 7:9: the end of the story is every tribe, tongue and nation around the throne. No more tears, no more mourning.</li>
        <li>We live in the middle of the story. What does that mean for us, right here in this coffee shop?</li>
      </ul></div>
    <div class="stack"><b>Stats</b>
      <ul class="guide-list">
        <li>Dropped in downtown Austin, you could find someone to share the gospel with you in 5 to 10 minutes. In Istanbul, it would take about 55 years.</li>
        <li>Every week in South Asia, 200,000 people die without hearing the gospel.</li>
        <li>There are 26 churches for every McDonald's in the US, and 300 evangelical churches for every unreached people group.</li>
        <li>Laborers to lostness is about 1 to 400 in the US. In unreached countries it's about 1 to 216,300.</li>
        <li>To reach an unreached people group takes about one worker per 50,000 people. That's like one person trying to reach all of UT.</li>
      </ul></div>
    <div class="stack"><b>Why we send long-term to the unreached</b>
      <ul class="guide-list">
        <li>Jesus told His disciples what comes before His return (Matthew 24:14) and what to do until then (Matthew 28:18–20).</li>
        <li>So we want our sending to be strategic: 3.5 billion people are unreached, most in the 10/40 window, and we send long-term, for 3 years or more.</li>
      </ul></div>
    <p>Then ask: <i>"How does all of that land on you? Have you heard any of it before?"</i> Process it together, get excited with them, and encourage them.</p>
  </div>
</details>

<details class="more">
  <summary>3. Opportunities</summary>
  <div class="stack-lg small">
    <p><i>"So people go overseas healthy, confident and trained, we have ways to learn to share Jesus here in Austin first. They're open to, and encouraged for, any follower of Jesus!"</i></p>
    <ul class="guide-list">
      <li><b>DMC</b>: the 10-week disciple-making group.</li>
      <li><b>ICT</b>: the 9-month training group for people preparing to go.</li>
    </ul>
    <p>Everyone has a role in the nations, and we want to help them find theirs.</p>
    <div class="stack"><b>Other options</b>
      <ul class="guide-list">
        <li>Missions Class</li>
        <li>A short-term trip or vision trip</li>
        <li>Advocacy teams</li>
        <li>Getting connected to goers who are raising support</li>
      </ul></div>
    <div class="stack"><b>Right now, before a class or group starts</b>
      <ul class="guide-list">
        <li>Pray with the ICT group, or join Nation's Prayer</li>
        <li>Go fishing with the ICT group and get in the harvest</li>
        <li>Send them one or two things from the Missions Hub (below). Ask what they're most likely to engage with, then follow up.</li>
        <li>Connect them with a mentor who has vision for the nations</li>
        <li>Go, pray, send, give, learn, welcome: help them see every way to take part</li>
      </ul></div>
  </div>
</details>

<details class="more">
  <summary>Keep in touch and end in prayer</summary>
  <div class="stack-lg small">
    <ul class="guide-list">
      <li>"I'd love to keep meeting with you and hear how you're doing!"</li>
      <li>"I'll send you [their next step], and I'd love to meet again before then!"</li>
      <li>"People God is stirring to go often have very few people encouraging that. Can we keep meeting to talk about this, and I'll help you take steps toward the nations?"</li>
      <li>"I'll text you and invite you to pray with the ICT group sometime."</li>
      <li>"How can I pray for you?"</li>
    </ul>
    <p class="card pad"><b>Log it in this app within 2 days</b> (a week at most): New Disco Meeting, with a next step and a follow-up-by date.</p>
  </div>
</details>

<details class="more">
  <summary>Curveballs to be ready for</summary>
  <div class="stack-lg small">
    <ul class="guide-list">
      <li><b>Medical missions, business as mission, law:</b> know what partnerships we have, and gently challenge the idea that they <i>need</i> one of these to go.</li>
      <li><b>World Race, Mercy Ships and similar:</b> ask how it went and whether it's shaping how they see long-term work.</li>
      <li><b>Student loans:</b> a real factor in timing; talk it through.</li>
      <li><b>Freshmen:</b> expect a longer timeline.</li>
      <li><b>Not following Jesus yet:</b> invite them to a Discovery Bible Group or a connect class.</li>
      <li><b>A big life crisis:</b> pivot to caring for them. You don't have to share about the nations if they need to be listened to.</li>
    </ul>
  </div>
</details>

<details class="more">
  <summary>After a DMC: follow-up questions</summary>
  <div class="stack-lg small">
    <ul class="guide-list">
      <li>What was your favorite part? The hardest part?</li>
      <li>How was the community?</li>
      <li>How were the prayer, fishing and book pieces?</li>
      <li>Have you thought of yourself as a goer at all? What barriers come up, and why?</li>
      <li>What's your next step?</li>
    </ul>
  </div>
</details>
`;

// Launch timeline: the stops a goer plans between starting the nine-month
// group and launching overseas. Built from the team's launch-timeline worksheet.
const STOPS = [
  { title: 'Goer training program', time: '9 months', note: 'The nine-month group (ICT) runs alongside everything below.' },
  { title: 'Talk with parents and family' },
  { title: 'Talk with church leaders' },
  { title: 'Perspectives course', time: '15 weeks' },
  { title: 'Vision trip', time: '2 weeks' },
  { title: 'Relationships and marriage', note: 'Where this stands can shape the timeline.' },
  { title: 'Support-raising training', time: '2 days' },
  { title: 'Support raising', time: '3–6 months' },
  {
    title: 'Team and agency requirements',
    list: ['Agency orientation', 'Language school', 'Cross-cultural training', 'Theological training'],
  },
];

export const TIMELINE_HTML = `
<p class="muted">Every goer's path is different. Use this with them to put real dates on each step, working back from a launch date.</p>
<ol class="timeline">
  <li class="tl-end"><b>Beginning of the nine-month group</b><span class="tiny muted">Start date: ________</span></li>
  ${STOPS.map((s) => `
  <li><div class="row" style="align-items:baseline"><b>${s.title}</b>${s.time ? `<span class="tag">${s.time}</span>` : ''}</div>
    ${s.note ? `<span class="tiny muted">${s.note}</span>` : ''}
    ${s.list ? `<ul class="guide-list tiny">${s.list.map((i) => `<li>${i}</li>`).join('')}</ul>` : ''}
  </li>`).join('')}
  <li class="tl-end"><b>Launch overseas</b><span class="tiny muted">Launch date: ________</span></li>
</ol>
`;
