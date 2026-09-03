// ============================================================
// SkillSetu Backend — SIH 26044
// A Node.js + Express server. Storage is a JSON file (data.json)
// acting as a lightweight database — simple, no separate DB
// server needed, easy to deploy for a prototype/demo.
// ============================================================

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); // serves the frontend

// Vercel: serve the SPA homepage explicitly from the Express function.
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---------- tiny "database" helpers ----------
function readData() {
  if (runtimeData) return runtimeData;
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}
let runtimeData = null;
function writeData(data) {
  runtimeData = data;
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    // Vercel's runtime filesystem is not durable. Keep changes in memory
    // for the current function instance so the prototype remains usable.
  }
}
function skillById(data, id) {
  return data.skills.find(s => s.id === id);
}
function makeVerificationId() {
  return 'VER-' + Math.random().toString(36).slice(2, 8).toUpperCase();
}

// ============================================================
// SKILLS
// ============================================================
app.get('/api/skills', (req, res) => {
  const data = readData();
  res.json(data.skills);
});

// ============================================================
// STUDENTS
// ============================================================
app.get('/api/students', (req, res) => {
  const data = readData();
  res.json(data.students);
});

app.get('/api/students/:id', (req, res) => {
  const data = readData();
  const student = data.students.find(s => s.id === req.params.id);
  if (!student) return res.status(404).json({ error: 'Student not found' });
  res.json(student);
});

// Add a new skill to a student's passport (starts as "pending")
app.post('/api/students/:id/skills', (req, res) => {
  const { skillId, proficiency } = req.body;
  if (!skillId || !proficiency) {
    return res.status(400).json({ error: 'skillId and proficiency are required' });
  }
  const data = readData();
  const student = data.students.find(s => s.id === req.params.id);
  if (!student) return res.status(404).json({ error: 'Student not found' });

  if (student.skills.some(sk => sk.skillId === skillId)) {
    return res.status(400).json({ error: 'This skill is already on the passport' });
  }

  student.skills.push({
    skillId, proficiency, status: 'pending', date: null, verId: null, qr: null
  });
  writeData(data);
  res.json(student);
});

// Verify a skill — this is the core trust step.
// Generates a verification record + a REAL QR code image (server-side).
app.post('/api/students/:id/skills/:skillIndex/verify', async (req, res) => {
  const data = readData();
  const student = data.students.find(s => s.id === req.params.id);
  if (!student) return res.status(404).json({ error: 'Student not found' });

  const idx = parseInt(req.params.skillIndex, 10);
  const skillEntry = student.skills[idx];
  if (!skillEntry) return res.status(404).json({ error: 'Skill entry not found' });

  const today = new Date().toISOString().slice(0, 10);
  const verId = makeVerificationId();

  // Step 1: save the verification record FIRST — this is the "database entry"
  // the QR code will point back to.
  skillEntry.status = 'verified';
  skillEntry.date = today;
  skillEntry.verId = verId;

  // Step 2: generate the actual QR code image using a standard library.
  // The QR encodes a short pointer, not the data itself — scanning it
  // just looks the record up (see /api/verify/:verId below).
  const qrText = `SKILLSETU-VERIFY:${verId}`;
  const qrDataUrl = await QRCode.toDataURL(qrText);
  skillEntry.qr = qrDataUrl;

  writeData(data);
  res.json(skillEntry);
});

// Simulates "scanning" a QR code — looks up the verification record.
// This is what a company's phone would hit when scanning a passport's QR.
app.get('/api/verify/:verId', (req, res) => {
  const data = readData();
  for (const student of data.students) {
    const skillEntry = student.skills.find(sk => sk.verId === req.params.verId);
    if (skillEntry) {
      return res.json({
        valid: true,
        student: student.name,
        college: student.college,
        skill: skillById(data, skillEntry.skillId).name,
        proficiency: skillEntry.proficiency,
        verifiedOn: skillEntry.date
      });
    }
  }
  res.status(404).json({ valid: false, error: 'No matching verification record' });
});

// ============================================================
// JOBS
// ============================================================
app.get('/api/jobs', (req, res) => {
  const data = readData();
  res.json(data.jobs);
});

app.post('/api/jobs', (req, res) => {
  const { title, org, loc, requirements } = req.body;
  if (!title || !org || !requirements || requirements.length === 0) {
    return res.status(400).json({ error: 'title, org, and at least one requirement are needed' });
  }
  const data = readData();
  const job = {
    id: 'j' + Date.now(),
    title, org, loc: loc || 'Not specified',
    requirements
  };
  data.jobs.push(job);
  writeData(data);
  res.json(job);
});

// ============================================================
// MATCH ENGINE — the core algorithm
// score = (sum of weights of VERIFIED matching skills) / (total required weight) * 100
// ============================================================
function computeMatch(data, student, job) {
  let total = 0, gained = 0;
  const matched = [], missing = [];
  job.requirements.forEach(req => {
    total += req.weight;
    const has = student.skills.find(sk => sk.skillId === req.skillId && sk.status === 'verified');
    if (has) { gained += req.weight; matched.push(skillById(data, req.skillId).name); }
    else { missing.push(skillById(data, req.skillId).name); }
  });
  const score = total ? Math.round((gained / total) * 100) : 0;
  return { score, matched, missing };
}

app.get('/api/jobs/:id/matches', (req, res) => {
  const data = readData();
  const job = data.jobs.find(j => j.id === req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  const ranked = data.students
    .map(s => ({ studentId: s.id, name: s.name, college: s.college, ...computeMatch(data, s, job) }))
    .sort((a, b) => b.score - a.score);

  res.json({ job, ranked });
});

// ============================================================
// MINISTRY DASHBOARD — aggregated skill demand across all jobs
// ============================================================
app.get('/api/dashboard', (req, res) => {
  const data = readData();

  const totalStudents = data.students.length;
  const totalVerified = data.students.reduce(
    (n, s) => n + s.skills.filter(sk => sk.status === 'verified').length, 0
  );
  const totalOpenings = data.jobs.length;

  const allScores = data.jobs.flatMap(j =>
    data.students.map(s => computeMatch(data, s, j).score)
  );
  const avgScore = allScores.length
    ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : 0;

  const demand = {};
  data.jobs.forEach(j => j.requirements.forEach(r => {
    demand[r.skillId] = (demand[r.skillId] || 0) + r.weight;
  }));
  const demandList = Object.entries(demand)
    .map(([skillId, weight]) => ({ skill: skillById(data, skillId).name, weight }))
    .sort((a, b) => b.weight - a.weight);

  res.json({ totalStudents, totalVerified, totalOpenings, avgScore, demandList });
});

// ============================================================
// CHATBOT — simple keyword-based FAQ assistant
// (A production version would call Bhashini's API for real
// regional-language understanding — this demonstrates the flow.)
// ============================================================
const CHATBOT_RESPONSES = [
  { keywords: ['internship', 'job', 'apply'], reply: 'You can browse and apply to openings from the Employer Desk tab once your skills are verified.' },
  { keywords: ['verify', 'verification', 'college'], reply: 'Your college verifies each skill you add. Once verified, it gets a scannable QR code on your passport.' },
  { keywords: ['match', 'score'], reply: 'Your match score shows what percentage of a job\'s required skills your verified profile actually covers.' },
  { keywords: ['qr', 'scan'], reply: 'Scanning the QR code looks up your verification record instantly — no need to call your college.' },
  { keywords: ['privacy', 'data', 'security'], reply: 'Your data is only shared with a company once you apply to their specific job — never shared automatically.' },
  { keywords: ['hello', 'hi', 'hey'], reply: 'Hi! Ask me about internships, verification, match scores, or data privacy.' }
];

app.post('/api/chatbot', (req, res) => {
  const message = (req.body.message || '').toLowerCase();
  const found = CHATBOT_RESPONSES.find(r => r.keywords.some(k => message.includes(k)));
  res.json({ reply: found ? found.reply : "I'm still learning — try asking about internships, verification, match scores, or privacy." });
});

// ============================================================
// Export the Express app for Vercel. Locally, keep the normal Node server.
module.exports = app;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`SkillSetu backend running at http://localhost:${PORT}`);
  });
}
