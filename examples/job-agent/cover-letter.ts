import { PROFILE } from "./profile.ts";

export function generateCoverLetter(jobTitle: string, company: string, jobDescription: string = ""): string {
  return `Dear Hiring Manager,

I am writing to apply for the ${jobTitle} position at ${company}. Having reviewed the role, I am confident that my background in administration, customer service and support work makes me a strong candidate.

I am currently a Support Worker at Hightown Housing Association, where I have developed extensive administrative skills alongside my care responsibilities. My day-to-day work involves preparing reports and correspondence in Microsoft Word, maintaining accurate records in line with GDPR, managing emails with external agencies and healthcare professionals, and providing minute-taking for team meetings and safeguarding discussions. I have consistently taken on responsibilities beyond my core role and pride myself on delivering high-quality work under pressure.

Prior to my current role, I spent over four years as a Sales Advisor at Wickes, where I managed customer accounts, processed orders, resolved complaints and built lasting relationships with trade clients. This experience, combined with earlier roles at Superdrug and Tesco, has given me a well-rounded foundation in customer-facing and operational environments.

I am proficient in Microsoft Word, Excel and Outlook, experienced in maintaining filing systems and producing detailed reports, and comfortable working both independently and as part of a team. I bring a calm, professional approach to every task and am a quick learner who is always eager to take on new challenges.

I am based in High Wycombe, which makes me ideally placed for roles across Buckinghamshire, and I am available to start with reasonable notice.

I would welcome the opportunity to discuss my application further. Thank you for considering me.

Yours sincerely,
${PROFILE.personal.name}
${PROFILE.personal.phone}
${PROFILE.personal.email}`;
}

export function generateCoverLetterForHR(company: string): string {
  return generateCoverLetter("HR & Administration role", company,
    "HR administration, office management, employee relations");
}
