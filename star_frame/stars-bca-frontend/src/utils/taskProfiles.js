const LEVEL_MAP = {
  'semester exam': ['< 60%', '60\u201369%', '70\u201379%', '80% and above'],
  'attendance': ['75\u201379%', '80\u201389%', '90\u201394%', '95% and above'],
  'internship': ['Case study/Mini project', 'Industry internship (2 weeks)', 'Industry internship (4 weeks)'],
  'case study': ['Case study/Mini project', 'Industry internship (2 weeks)', 'Industry internship (4 weeks)'],
  'mini project': ['Case study/Mini project', 'Industry internship (2 weeks)', 'Industry internship (4 weeks)'],
  'visit': ['Industrial Visit completed', 'Institutional Visit completed', 'International Visit / Conference'],
  'library': ['5 Hrs', '10 Hrs', '15 Hrs'],
  'scholarship': ['Applied for scholarship', 'Scholarship received', 'Merit Scholarship'],
  'nptel': ['Registered & Completed Assignments', 'Successfully completed', 'Elite', 'Elite with Gold/Silver badge'],
  'online certification': ['Completed 1 course', 'Specialisation / multi-course', 'Professional certificate', '2 professional certs'],
  'industry certification': ['Foundation level', 'Associate level', 'Professional level', 'Expert / Speciality level'],
  'short mooc': ['Enrolled & completed', '2 MOOCs completed', '3+ MOOCs with assessment'],
  'value added course': ['VAC with assessment / internal certification', 'External agency / industry expert with certification'],
  'leetcode': ['Profile + 5\u201320 Easy', '50 Easy / 10 Medium', '50 Medium problems', '100+ Medium / Hard / Top 10%'],
  'hackerrank': ['Profile + 5\u201320 Easy', '50 Easy / 10 Medium', '50 Medium problems', '100+ Medium / Hard / Top 10%'],
  'hackerearth': ['Profile + 5\u201320 Easy', '50 Easy / 10 Medium', '50 Medium problems', '100+ Medium / Hard / Top 10%'],
  'programming, data structures': ['Basic assessment cleared', 'Intermediate cleared', 'Advanced cleared', 'Expert / Certification'],
  'codechef': ['1\u20132 Star / 25 problems', '3 Star / 50 problems', '4 Star / 100 problems', '5 Star / 200 problems'],
  'geeksforgeeks': ['1\u20132 Star / 25 problems', '3 Star / 50 problems', '4 Star / 100 problems', '5 Star / 200 problems'],
  'coding contest': ['Participated', 'Top 50%', 'Finalist', 'Winner'],
  'open-source': ['GitHub profile + starred/forked repo + raised an issue', 'Pull Request submitted'],
  'hackathon': ['Participated', 'Qualified round / finalist', 'Regional/Local winner', 'IIT/NIT /National winner'],
  'datathon': ['Participated', 'Qualified round / finalist', 'Regional/Local winner', 'IIT/NIT /National winner'],
  'ideathon': ['Participated', 'Shortlisted / top 50%', 'Finalist', 'Winner'],
  'business plan': ['Participated', 'Shortlisted / top 50%', 'Finalist', 'Winner'],
  'startup': ['Participated / idea submitted', 'Prototype / MVP built', 'Incubated', 'Startup registered / funded'],
  'technical event': ['Intra-college participation', 'Intra-college winner / Inter-college participation', 'Inter-college winner', 'State/national winner'],
  'paper presentation': ['Internal / Department', 'External/Intercollegiate', 'State / National level', 'International'],
  'conference / journal': ['Abstract submitted', 'Conference paper published', 'Indexed conference', 'Indexed journal (Scopus)'],
  'patent': ['Draft filed', 'Published', 'Granted', 'Copyright'],
  'book chapter': ['Internal project report', 'Book chapter submitted', 'Book chapter published', 'International publisher'],
  'workshop': ['1 event attended', '2 events attended', '3+ events / paper presented', 'Best paper / award'],
  'symposium': ['1 event attended', '2 events attended', '3+ events / paper presented', 'Best paper / award'],
  'kaggle': ['Profile created + participated', 'Top 50%', 'Bronze / top 25%', 'Silver/Gold / top 10%'],
  'analytics vidhya': ['Profile created + participated', 'Top 50%', 'Bronze / top 25%', 'Silver/Gold / top 10%'],
  'ai / ml': ['Prototype / idea stage', 'Functional project', 'Deployed (app / dashboard)', 'Real user adoption / published'],
  'web dev': ['Prototype / idea stage', 'Functional project', 'Deployed (app / dashboard)', 'Real user adoption / published'],
  'networking project': ['Prototype / idea stage', 'Functional project', 'Deployed (app / dashboard)', 'Real user adoption / published'],
  'live project': ['Basic deployment', 'Multi-service deployment', 'Production-ready', 'Certified + deployed'],
  'genai': ['Used AI tools + documented', 'Built GenAI-integrated project', 'Deployed GenAI app', 'Industry / research recognised'],
  'prompt engineering': ['Used AI tools + documented', 'Built GenAI-integrated project', 'Deployed GenAI app', 'Industry / research recognised'],
  'linkedin': ['Profile created (Professional)', '50 connections + active posts + tagging college, Principal, Dean & HOD', '100 connections + weekly posts + engagement (likes/comments)', 'Recommendations + thought leader + college/department featured/shared your post'],
  'github portfolio': ['Account + 2\u20135 repos', '5\u201310 repos with README', 'Practical work submission', 'Mini-projects / projects submission'],
  'portfolio website': ['Basic portfolio page', 'Professional with projects', 'Project showcase + deployed'],
  'technical blog': ['3 blogs / 3 videos', '5 blogs', '10 blogs / YouTube channel', 'Industry / media recognition'],
  'podcast': ['3 blogs / 3 videos', '5 blogs', '10 blogs / YouTube channel', 'Industry / media recognition'],
  'peer mentoring': ['Helped 1\u20132 students', 'Study group / 5 students', 'Workshop / session conducted (class / juniors)', 'Structured mentoring programme'],
  'knowledge sharing': ['Helped 1\u20132 students', 'Study group / 5 students', 'Workshop / session conducted (class / juniors)', 'Structured mentoring programme'],
  'student council': ['Member', 'Active contributor', 'Coordinator / Jt. Secretary', 'President / Secretary'],
  'club': ['Member', 'Active contributor', 'Coordinator / Jt. Secretary', 'President / Secretary'],
  'professional conduct': ['Awarded by Mentor'],
  'event organising': ['Volunteer in a department-level event', 'Core committee member in college-level event', 'Coordinator / Joint Secretary of major college event', 'Chief Organiser / Convenor of inter-college / national event'],
  'nss': ['Enrolled', 'Active volunteer', 'Event organiser / camp', 'Camp leader / award'],
  'ncc': ['Enrolled', 'Certificate A/B', 'Certificate C', 'Leadership / National'],
  'cultural': ['College-level participation', 'Intercollegiate participation', 'Intercollegiate winner', 'State / national level'],
  'sports': ['College-level participation', 'Intercollegiate participation', 'Intercollegiate winner', 'State / national level'],
  'community outreach': ['Participated in 1 activity', 'Active volunteer (3+ events)', 'Coordinator / project lead', 'Measurable social impact'],
  'social initiative': ['Participated in 1 activity', 'Active volunteer (3+ events)', 'Coordinator / project lead', 'Measurable social impact'],
  'air-rifle': ['Enrolled', 'District level', 'State level', 'National level'],
  'resume': ['Basic draft created', 'Senior reviewed', 'ATS-optimised', 'Industry-reviewed / LinkedIn synced'],
  'mock interview': ['Attended mock / aptitude', 'Cleared aptitude test (>=60%)', 'High rating mock interview', 'Outstanding / top performer'],
  'aptitude': ['Attended mock / aptitude', 'Cleared aptitude test (>=60%)', 'High rating mock interview', 'Outstanding / top performer'],
  'placement': ['Internship offer received', 'Placement offer (<5 LPA)', 'Placement offer (5-10 LPA)', 'Dream offer (>10 LPA)'],
  'internship offer': ['Internship offer received', 'Placement offer (<5 LPA)', 'Placement offer (5-10 LPA)', 'Dream offer (>10 LPA)'],
  'higher studies': ['Appeared in exam', 'Qualified / cleared', 'Good percentile (>=70%ile)', 'Top rank / scholarship / admission'],
  'competitive exam': ['Appeared in exam', 'Qualified / cleared', 'Good percentile (>=70%ile)', 'Top rank / scholarship / admission'],
}

export function normalizeTaskName(value = '') {
  return String(value || '').toLowerCase()
}

export function getTaskProfile(task = {}) {
  const name = normalizeTaskName(task?.name)

  if (name.includes('internship') || name.includes('case study') || name.includes('mini project')) {
    return {
      group: 'activity-1',
      defaultOption: name.includes('internship') ? 'Internship' : name.includes('case study') ? 'Case Study' : 'Mini Project',
      options: ['Internship', 'Case Study', 'Mini Project'],
    }
  }

  if (name.includes('visit')) {
    return {
      group: 'activity-2',
      defaultOption: name.includes('industrial') ? 'Industrial Visit' : name.includes('institutional') ? 'Institutional Visit' : 'International Visit',
      options: ['Industrial Visit', 'Institutional Visit', 'International Visit'],
    }
  }

  if (name.includes('live project') || name.includes('github portfolio') || name.includes('portfolio website') ||
      name.includes('linkedin') || name.includes('kaggle') || name.includes('genai') ||
      name.includes('ai / ml') || name.includes('open-source')) {
    return { group: 'url', defaultOption: '', options: [] }
  }

  for (const [key, options] of Object.entries(LEVEL_MAP)) {
    if (name.includes(key)) return { group: 'level-select', defaultOption: '', options }
  }

  return { group: 'generic', defaultOption: '', options: [] }
}

export function getSubmissionRules(activeTask, { activityOption, visitOption, selectedLevel, urlInput, fileName }) {
  const profile = getTaskProfile(activeTask)
  const selectedActivity = profile.group === 'activity-1' ? activityOption : profile.group === 'activity-2' ? visitOption : ''
  const isInternship = selectedActivity === 'Internship'
  const isCaseStudy = selectedActivity === 'Case Study'
  const isMiniProject = selectedActivity === 'Mini Project'

  const requiresFile = profile.group === 'generic' || profile.group === 'activity-2' ||
    isInternship || isCaseStudy
  const requiresUrl = isMiniProject || profile.group === 'url'
  const requiresLevel = profile.group === 'level-select'

  const canSubmit =
    (requiresFile ? Boolean(fileName) : true) &&
    (requiresUrl ? Boolean(urlInput.trim()) : true) &&
    (requiresLevel ? Boolean(selectedLevel) : true)

  return { profile, selectedActivity, isInternship, isCaseStudy, isMiniProject, requiresFile, requiresUrl, requiresLevel, canSubmit }
}
