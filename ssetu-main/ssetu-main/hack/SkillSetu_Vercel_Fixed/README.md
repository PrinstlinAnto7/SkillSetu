# SkillSetu — Professional SIH Prototype

This version is designed to work in two ways:

## 1. Open `public/index.html` directly
Double-click `public/index.html`. The polished UI, role-based registration, profile creation, certificate upload demo, dashboards and smart demo assistant work without the Node server. Demo account data is stored in browser localStorage.

## 2. Run the full Node/Express version
From this project folder:

```bash
npm install
npm start
```

Then open `http://localhost:3000`.

## Main prototype flow
- Landing / Login
- Three role paths: Student, College, Company
- Student registration: account → college/department → skills → certificate uploads → profile
- College registration: institution identity, official website, location, authorized contact/context
- Company registration: organization identity, website, location, hiring contact/context
- Student Skill Passport with skill status and credentials
- Opportunities and explainable matching
- Company candidate matching and opportunity posting
- College skill-gap and industry-demand analytics
- Verification Center with realistic pending/verified language
- AI Assistant with contextual demo answers

## Verification note
An uploaded certificate is not automatically genuine. A production implementation should verify against the issuing organization's QR, online verification portal or API where available, with authorized institutional review for exceptions. SkillSetu-generated QR codes should point to SkillSetu verification records and should not be represented as proof of original issuer authenticity unless that issuer verification has actually happened.
