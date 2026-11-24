/**
 * Seeds realistic Indian dummy data for local development/testing:
 * users, demands, candidates, demand<->candidate submissions, recruiter
 * allocations, and interviews. Idempotent — safe to re-run.
 *
 * Usage: npm run seed:dummy
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { hashPassword } from '../src/lib/auth/password';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const DEFAULT_PASSWORD = 'Test@123';

// ───────────────────────── Users ─────────────────────────

const USERS = [
  { email: 'arjun.sharma@costaff-demo.in', first_name: 'Arjun', last_name: 'Sharma', role: 'super_admin', phone: '+919876500101' },
  { email: 'priya.mehta@costaff-demo.in', first_name: 'Priya', last_name: 'Mehta', role: 'account_manager', phone: '+919876500102' },
  { email: 'rohit.verma@costaff-demo.in', first_name: 'Rohit', last_name: 'Verma', role: 'account_manager', phone: '+919876500103' },
  { email: 'sneha.iyer@costaff-demo.in', first_name: 'Sneha', last_name: 'Iyer', role: 'spoc', phone: '+919876500104' },
  { email: 'karan.malhotra@costaff-demo.in', first_name: 'Karan', last_name: 'Malhotra', role: 'ta', phone: '+919876500105' },
  { email: 'ananya.das@costaff-demo.in', first_name: 'Ananya', last_name: 'Das', role: 'ta', phone: '+919876500106' },
  { email: 'vikram.singh@costaff-demo.in', first_name: 'Vikram', last_name: 'Singh', role: 'hr', phone: '+919876500107' },
  { email: 'neha.kapoor@costaff-demo.in', first_name: 'Neha', last_name: 'Kapoor', role: 'viewer', phone: '+919876500108' },
] as const;

// ───────────────────────── Currencies / Comp types ─────────────────────────

const CURRENCIES = [
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', sort_order: 1 },
  { code: 'USD', name: 'US Dollar', symbol: '$', sort_order: 2 },
];

const COMP_TYPES = [
  { name: 'Yearly', sort_order: 1 },
  { name: 'Monthly', sort_order: 2 },
  { name: 'Hourly', sort_order: 3 },
];

// ───────────────────────── Demands ─────────────────────────

const DEMANDS = [
  {
    request_id: 'CSF-DUMMY-0001',
    job_title: 'Senior Full Stack Developer',
    client_name: 'Infranova Technologies',
    company_name: 'Infranova Technologies Pvt Ltd',
    company_email: 'hiring@infranova-demo.in',
    skill_description: 'Build and scale full-stack features across a Next.js + Node.js platform, owning both API and UI layers.',
    technology_stack: ['React', 'Node.js', 'TypeScript', 'PostgreSQL'],
    role_category: 'Full Time',
    experience_level: '5-8 years',
    locations: ['Bengaluru', 'Pune'],
    work_mode: 'Hybrid',
    priority: 'High',
    status: 'Sourcing',
    num_positions: 2,
    compensation_min: 1800000,
    compensation_max: 2600000,
    currency: 'INR',
    comp_type: 'Yearly',
    amEmail: 'priya.mehta@costaff-demo.in',
    spocEmail: 'sneha.iyer@costaff-demo.in',
    recruiterEmails: ['karan.malhotra@costaff-demo.in'],
  },
  {
    request_id: 'CSF-DUMMY-0002',
    job_title: 'Backend Developer',
    client_name: 'Meridian Finserv',
    company_name: 'Meridian Finserv Solutions',
    company_email: 'talent@meridian-demo.in',
    skill_description: 'Design resilient backend services for a high-volume payments platform; strong focus on reliability and data integrity.',
    technology_stack: ['Java', 'Spring Boot', 'Kafka', 'MySQL'],
    role_category: 'Full Time',
    experience_level: '3-6 years',
    locations: ['Hyderabad'],
    work_mode: 'Work On Site',
    priority: 'Medium',
    status: 'Shortlist',
    num_positions: 1,
    compensation_min: 1200000,
    compensation_max: 1800000,
    currency: 'INR',
    comp_type: 'Yearly',
    amEmail: 'rohit.verma@costaff-demo.in',
    spocEmail: 'sneha.iyer@costaff-demo.in',
    recruiterEmails: ['ananya.das@costaff-demo.in'],
  },
  {
    request_id: 'CSF-DUMMY-0003',
    job_title: 'React Developer',
    client_name: 'Bluepeak Retail',
    company_name: 'Bluepeak Retail Technologies',
    company_email: 'careers@bluepeak-demo.in',
    skill_description: 'Own front-end delivery for a high-traffic e-commerce storefront, collaborating closely with design and product.',
    technology_stack: ['React', 'Redux', 'TypeScript', 'Tailwind CSS'],
    role_category: 'Contract',
    experience_level: '2-5 years',
    locations: ['Remote'],
    work_mode: 'Remote',
    priority: 'Medium',
    status: 'Assign',
    num_positions: 3,
    compensation_min: 900000,
    compensation_max: 1400000,
    currency: 'INR',
    comp_type: 'Yearly',
    amEmail: 'priya.mehta@costaff-demo.in',
    spocEmail: null,
    recruiterEmails: ['karan.malhotra@costaff-demo.in', 'ananya.das@costaff-demo.in'],
  },
  {
    request_id: 'CSF-DUMMY-0004',
    job_title: 'Data Engineer',
    client_name: 'Horizon Analytics',
    company_name: 'Horizon Analytics Pvt Ltd',
    company_email: 'hr@horizon-demo.in',
    skill_description: 'Build and maintain batch and streaming data pipelines feeding the company’s analytics warehouse.',
    technology_stack: ['Python', 'Airflow', 'Spark', 'AWS'],
    role_category: 'Full Time',
    experience_level: '4-7 years',
    locations: ['Gurugram', 'Noida'],
    work_mode: 'Hybrid',
    priority: 'High',
    status: 'Selection',
    num_positions: 1,
    compensation_min: 1600000,
    compensation_max: 2200000,
    currency: 'INR',
    comp_type: 'Yearly',
    amEmail: 'rohit.verma@costaff-demo.in',
    spocEmail: 'sneha.iyer@costaff-demo.in',
    recruiterEmails: ['ananya.das@costaff-demo.in'],
  },
  {
    request_id: 'CSF-DUMMY-0005',
    job_title: 'DevOps Engineer',
    client_name: 'Nimbus Cloud Systems',
    company_name: 'Nimbus Cloud Systems Ltd',
    company_email: 'jobs@nimbus-demo.in',
    skill_description: 'Own CI/CD, infrastructure-as-code and observability for a multi-tenant SaaS platform running on Kubernetes.',
    technology_stack: ['Kubernetes', 'Terraform', 'AWS', 'Docker'],
    role_category: 'Full Time',
    experience_level: '3-6 years',
    locations: ['Pune'],
    work_mode: 'Hybrid',
    priority: 'Low',
    status: 'Onboarding',
    num_positions: 1,
    compensation_min: 1400000,
    compensation_max: 2000000,
    currency: 'USD',
    comp_type: 'Monthly',
    amEmail: 'priya.mehta@costaff-demo.in',
    spocEmail: null,
    recruiterEmails: ['karan.malhotra@costaff-demo.in'],
  },
  {
    request_id: 'CSF-DUMMY-0006',
    job_title: 'Java Developer',
    client_name: '[TEST] Infranova Technologies',
    company_name: '[TEST] Infranova Technologies',
    company_email: 'hiring@infranova-demo.in',
    skill_description: 'Sourcing bench held at the five-active-profile cap, with two backup profiles waiting.',
    technology_stack: ['Java', 'Spring Boot'],
    role_category: 'Full Time',
    experience_level: '3-6 years',
    locations: ['Bangalore'],
    work_mode: 'Hybrid',
    priority: 'High',
    status: 'Sourcing',
    num_positions: 1,
    compensation_min: 1200000,
    compensation_max: 1800000,
    currency: 'INR',
    comp_type: 'Yearly',
    amEmail: 'priya.mehta@costaff-demo.in',
    spocEmail: 'sneha.iyer@costaff-demo.in',
    recruiterEmails: ['karan.malhotra@costaff-demo.in'],
  },
  {
    request_id: 'CSF-DUMMY-0007',
    job_title: 'Business Analyst',
    client_name: '[TEST] Meridian Finserv',
    company_name: '[TEST] Meridian Finserv',
    company_email: 'talent@meridian-demo.in',
    skill_description: 'Newly opened demand. No recruiters assigned yet.',
    technology_stack: ['SQL', 'Excel'],
    role_category: 'Full Time',
    experience_level: '4-7 years',
    locations: ['Chennai'],
    work_mode: 'Work On Site',
    priority: 'Medium',
    status: 'Open',
    num_positions: 2,
    compensation_min: 1000000,
    compensation_max: 1500000,
    currency: 'INR',
    comp_type: 'Yearly',
    amEmail: 'priya.mehta@costaff-demo.in',
    spocEmail: null,
    recruiterEmails: [],
  },
  {
    request_id: 'CSF-DUMMY-0008',
    job_title: 'QA Lead',
    client_name: '[TEST] Bluepeak Retail',
    company_name: '[TEST] Bluepeak Retail',
    company_email: 'careers@bluepeak-demo.in',
    skill_description: 'Closed demand with a written closing comment.',
    technology_stack: ['Selenium', 'Java'],
    role_category: 'Contract',
    experience_level: '6-9 years',
    locations: ['Hyderabad'],
    work_mode: 'Hybrid',
    priority: 'Low',
    status: 'Closure',
    num_positions: 1,
    compensation_min: 1400000,
    compensation_max: 1800000,
    currency: 'INR',
    comp_type: 'Yearly',
    amEmail: 'rohit.verma@costaff-demo.in',
    spocEmail: 'sneha.iyer@costaff-demo.in',
    recruiterEmails: ['ananya.das@costaff-demo.in'],
  },
] as const;

// ───────────────────────── Candidates ─────────────────────────

const CANDIDATES = [
  { full_name: 'Aditya Kulkarni', email: 'aditya.kulkarni@dummymail.in', phone: '+919811100201', skills: ['React', 'Node.js', 'TypeScript', 'PostgreSQL'], current_location: 'Bengaluru', current_company: 'Zenith Softwares', current_designation: 'Senior Software Engineer', total_experience: '6 years', current_ctc: 1900000, expected_ctc: 2500000, source: 'naukri', availability: '30 Days' },
  { full_name: 'Isha Reddy', email: 'isha.reddy@dummymail.in', phone: '+919811100202', skills: ['React', 'JavaScript', 'CSS', 'Redux'], current_location: 'Hyderabad', current_company: 'Cognizant', current_designation: 'Software Engineer', total_experience: '3 years', current_ctc: 1000000, expected_ctc: 1400000, source: 'linkedin', availability: '15 Days' },
  { full_name: 'Rahul Nair', email: 'rahul.nair@dummymail.in', phone: '+919811100203', skills: ['Node.js', 'Express', 'MongoDB', 'TypeScript'], current_location: 'Chennai', current_company: 'Freshworks', current_designation: 'Backend Developer', total_experience: '4 years', current_ctc: 1300000, expected_ctc: 1800000, source: 'referral', availability: 'Immediate' },
  { full_name: 'Simran Kaur', email: 'simran.kaur@dummymail.in', phone: '+919811100204', skills: ['Java', 'Spring Boot', 'Kafka', 'MySQL'], current_location: 'Hyderabad', current_company: 'Infosys', current_designation: 'Senior Consultant', total_experience: '5 years', current_ctc: 1500000, expected_ctc: 2000000, source: 'naukri', availability: '60 Days' },
  { full_name: 'Devansh Joshi', email: 'devansh.joshi@dummymail.in', phone: '+919811100205', skills: ['Java', 'Spring', 'MySQL'], current_location: 'Pune', current_company: 'TCS', current_designation: 'Software Engineer', total_experience: '3 years', current_ctc: 900000, expected_ctc: 1200000, source: 'direct', availability: '30 Days' },
  { full_name: 'Pooja Shetty', email: 'pooja.shetty@dummymail.in', phone: '+919811100206', skills: ['React', 'TypeScript', 'Tailwind CSS', 'Redux'], current_location: 'Mumbai', current_company: 'Razorpay', current_designation: 'Frontend Engineer', total_experience: '4 years', current_ctc: 1400000, expected_ctc: 1900000, source: 'linkedin', availability: '15 Days' },
  { full_name: 'Manish Agarwal', email: 'manish.agarwal@dummymail.in', phone: '+919811100207', skills: ['React', 'JavaScript', 'HTML', 'CSS'], current_location: 'Delhi', current_company: 'Paytm', current_designation: 'Software Engineer II', total_experience: '2 years', current_ctc: 800000, expected_ctc: 1100000, source: 'naukri', availability: 'Immediate' },
  { full_name: 'Kavya Pillai', email: 'kavya.pillai@dummymail.in', phone: '+919811100208', skills: ['Python', 'Airflow', 'Spark', 'SQL'], current_location: 'Gurugram', current_company: 'Mu Sigma', current_designation: 'Data Engineer', total_experience: '5 years', current_ctc: 1700000, expected_ctc: 2300000, source: 'referral', availability: '30 Days' },
  { full_name: 'Siddharth Rao', email: 'siddharth.rao@dummymail.in', phone: '+919811100209', skills: ['Python', 'Spark', 'AWS', 'SQL'], current_location: 'Noida', current_company: 'Nagarro', current_designation: 'Senior Data Engineer', total_experience: '6 years', current_ctc: 2000000, expected_ctc: 2600000, source: 'naukri', availability: '60 Days' },
  { full_name: 'Tanvi Bhatt', email: 'tanvi.bhatt@dummymail.in', phone: '+919811100210', skills: ['Python', 'ETL', 'AWS', 'Airflow'], current_location: 'Bengaluru', current_company: 'Flipkart', current_designation: 'Data Engineer II', total_experience: '4 years', current_ctc: 1500000, expected_ctc: 2000000, source: 'linkedin', availability: '15 Days' },
  { full_name: 'Aryan Chawla', email: 'aryan.chawla@dummymail.in', phone: '+919811100211', skills: ['Kubernetes', 'Terraform', 'AWS', 'Docker'], current_location: 'Pune', current_company: 'Druva', current_designation: 'DevOps Engineer', total_experience: '4 years', current_ctc: 1600000, expected_ctc: 2100000, source: 'direct', availability: '30 Days' },
  { full_name: 'Meera Krishnan', email: 'meera.krishnan@dummymail.in', phone: '+919811100212', skills: ['Kubernetes', 'Docker', 'CI/CD', 'Jenkins'], current_location: 'Chennai', current_company: 'Zoho', current_designation: 'Site Reliability Engineer', total_experience: '5 years', current_ctc: 1800000, expected_ctc: 2400000, source: 'referral', availability: 'Immediate' },
  { full_name: 'Yash Trivedi', email: 'yash.trivedi@dummymail.in', phone: '+919811100213', skills: ['AWS', 'Terraform', 'Linux'], current_location: 'Ahmedabad', current_company: 'Zensar', current_designation: 'Cloud Engineer', total_experience: '3 years', current_ctc: 1100000, expected_ctc: 1500000, source: 'naukri', availability: '15 Days' },
  { full_name: 'Diya Menon', email: 'diya.menon@dummymail.in', phone: '+919811100214', skills: ['React', 'Node.js', 'GraphQL', 'TypeScript'], current_location: 'Bengaluru', current_company: 'Swiggy', current_designation: 'Full Stack Engineer', total_experience: '5 years', current_ctc: 1900000, expected_ctc: 2500000, source: 'linkedin', availability: '30 Days' },
  { full_name: 'Nikhil Bose', email: 'nikhil.bose@dummymail.in', phone: '+919811100215', skills: ['Node.js', 'Express', 'PostgreSQL'], current_location: 'Kolkata', current_company: 'Ericsson', current_designation: 'Software Developer', total_experience: '2 years', current_ctc: 700000, expected_ctc: 1000000, source: 'direct', availability: '60 Days' },
  { full_name: 'Riya Saxena', email: 'riya.saxena@dummymail.in', phone: '+919811100216', skills: ['Java', 'Microservices', 'Kafka'], current_location: 'Hyderabad', current_company: 'Deloitte', current_designation: 'Consultant', total_experience: '4 years', current_ctc: 1300000, expected_ctc: 1700000, source: 'referral', availability: '30 Days' },
  { full_name: 'Harsh Vora', email: 'harsh.vora@dummymail.in', phone: '+919811100217', skills: ['React', 'Vue.js', 'JavaScript'], current_location: 'Mumbai', current_company: 'Myntra', current_designation: 'Frontend Developer', total_experience: '3 years', current_ctc: 1200000, expected_ctc: 1600000, source: 'naukri', availability: '15 Days' },
  { full_name: 'Alisha Fernandes', email: 'alisha.fernandes@dummymail.in', phone: '+919811100218', skills: ['Python', 'Django', 'PostgreSQL'], current_location: 'Goa', current_company: 'Vymo', current_designation: 'Backend Developer', total_experience: '3 years', current_ctc: 1100000, expected_ctc: 1500000, source: 'linkedin', availability: 'Immediate' },
] as const;

// ───────────────────────── Helpers ─────────────────────────

function dec(n: number) {
  return n.toString();
}

async function main() {
  console.log('Resolving currencies & compensation types...');
  const currencyByCode = new Map<string, string>();
  for (const c of CURRENCIES) {
    const existing = await prisma.compensation_currencies.findUnique({ where: { code: c.code } });
    const row = existing ?? await prisma.compensation_currencies.create({ data: c });
    currencyByCode.set(c.code, row.id);
  }
  const compTypeByName = new Map<string, string>();
  for (const t of COMP_TYPES) {
    const existing = await prisma.compensation_types.findUnique({ where: { name: t.name } });
    const row = existing ?? await prisma.compensation_types.create({ data: t });
    compTypeByName.set(t.name, row.id);
  }

  console.log('Seeding users...');
  const userByEmail = new Map<string, string>();
  const password_hash = await hashPassword(DEFAULT_PASSWORD);
  for (const u of USERS) {
    const row = await prisma.profiles.upsert({
      where: { email: u.email },
      update: {
        first_name: u.first_name,
        last_name: u.last_name,
        full_name: `${u.first_name} ${u.last_name}`,
        role: u.role,
        phone: u.phone,
        is_active: true,
        status: 'ACTIVE',
      },
      create: {
        email: u.email,
        first_name: u.first_name,
        last_name: u.last_name,
        full_name: `${u.first_name} ${u.last_name}`,
        role: u.role,
        phone: u.phone,
        password_hash,
        is_active: true,
        status: 'ACTIVE',
        date_of_joining: new Date('2024-01-15'),
      },
    });
    userByEmail.set(u.email, row.id);
  }

  console.log('Seeding [TEST] clients, end clients, and a skill group...');
  const skillGroup = await prisma.skill_categories.upsert({
    where: { name: '[TEST] Engineering' },
    update: { description: 'Demo skill group. Removed by npm run seed:dummy:clear.', is_active: true },
    create: { name: '[TEST] Engineering', description: 'Demo skill group. Removed by npm run seed:dummy:clear.', sort_order: 90 },
  });
  for (const [name, skillType] of [['[TEST] React', 'mandatory'], ['[TEST] Java', 'optional']] as const) {
    await prisma.skills.upsert({
      where: { category_id_name: { category_id: skillGroup.id, name } },
      update: { skill_type: skillType, is_active: true },
      create: { category_id: skillGroup.id, name, skill_type: skillType, sort_order: 1 },
    });
  }

  const companyByEmail = new Map<string, { id: string; spocId: string }>();
  const demoCompanies = [
    { name: '[TEST] Infranova Technologies', email: 'hiring@infranova-demo.in', city: 'Bangalore', spoc: 'Asha Rao' },
    { name: '[TEST] Meridian Finserv', email: 'talent@meridian-demo.in', city: 'Chennai', spoc: 'Vikram Iyer' },
    { name: '[TEST] Bluepeak Retail', email: 'careers@bluepeak-demo.in', city: 'Hyderabad', spoc: 'Leela Nair' },
    { name: '[TEST] Horizon Analytics', email: 'hr@horizon-demo.in', city: 'Hyderabad', spoc: 'Omar Shah' },
    { name: '[TEST] Nimbus Cloud', email: 'jobs@nimbus-demo.in', city: 'Bangalore', spoc: 'Nina Paul' },
  ];
  for (const company of demoCompanies) {
    const existing = await prisma.companies.findFirst({ where: { email: company.email } });
    const row = existing
      ? await prisma.companies.update({
          where: { id: existing.id },
          data: { name: company.name, client_name: company.name, city: company.city, status: 'ACTIVE' },
        })
      : await prisma.companies.create({
          data: {
            name: company.name,
            client_name: company.name,
            email: company.email,
            city: company.city,
            country: 'India',
            status: 'ACTIVE',
            account_manager_id: userByEmail.get('priya.mehta@costaff-demo.in'),
          },
        });
    const spocEmail = company.email.replace('@', '.spoc@');
    const existingSpoc = await prisma.company_spocs.findFirst({ where: { company_id: row.id, email: spocEmail } });
    const spoc = existingSpoc ?? await prisma.company_spocs.create({
      data: { company_id: row.id, name: company.spoc, email: spocEmail, phone: '+919800000000', designation: 'Hiring manager' },
    });
    companyByEmail.set(company.email, { id: row.id, spocId: spoc.id });
  }

  const endClient = await prisma.end_clients.findFirst({ where: { name: '[TEST] Northwind Bank' } });
  const endClientRow = endClient ?? await prisma.end_clients.create({
    data: {
      name: '[TEST] Northwind Bank',
      location: 'Bangalore',
      description: 'Demo end client. Removed by npm run seed:dummy:clear.',
      status: 'ACTIVE',
      created_by: userByEmail.get('priya.mehta@costaff-demo.in'),
    },
  });

  console.log('Seeding demands...');
  const demandByRequestId = new Map<string, string>();
  const amId = userByEmail.get('priya.mehta@costaff-demo.in')!;
  for (const d of DEMANDS) {
    const amProfileId = userByEmail.get(d.amEmail)!;
    const spocProfileId = d.spocEmail ? userByEmail.get(d.spocEmail)! : null;
    const company = companyByEmail.get(d.company_email);
    const openedAt = d.request_id === 'CSF-DUMMY-0001'
      ? new Date(Date.now() - 45 * 24 * 60 * 60 * 1000)
      : d.request_id === 'CSF-DUMMY-0008'
        ? new Date(Date.now() - 70 * 24 * 60 * 60 * 1000)
        : new Date();
    const demandData = {
      job_title: d.job_title,
      client_name: d.client_name.startsWith('[TEST]') ? d.client_name : `[TEST] ${d.client_name}`,
      company_name: d.company_name.startsWith('[TEST]') ? d.company_name : `[TEST] ${d.company_name}`,
      company_email: d.company_email,
      company_id: company?.id ?? null,
      end_client_id: endClientRow.id,
      skills_category_id: skillGroup.id,
      skill_description: d.skill_description,
      technology_stack: [...d.technology_stack],
      role_category: d.role_category,
      experience_levels: [d.experience_level],
      locations: [...d.locations],
      work_mode: d.work_mode,
      priority: d.priority,
      status: d.status,
      demand_type: 'Technical',
      engagement_type: d.priority === 'High' ? 'Active' : 'Proactive',
      client_demand_id: `CLI-${d.request_id}`,
      intermediary_partner: '[TEST] Partner Desk',
      customer_jd: d.skill_description,
      client_spoc_ids: company ? [company.spocId] : [],
      num_positions: d.num_positions,
      compensation_min: dec(d.compensation_min),
      compensation_max: dec(d.compensation_max),
      compensation_currency_id: currencyByCode.get(d.currency),
      compensation_type_id: compTypeByName.get(d.comp_type),
      contact_profile_id: amProfileId,
      spoc_profile_id: spocProfileId,
      opened_at: openedAt,
      closed_at: d.status === 'Closure' ? new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) : null,
    };
    const existingDemand = await prisma.demands.findFirst({ where: { request_id: d.request_id } });
    const row = existingDemand
      ? await prisma.demands.update({ where: { id: existingDemand.id }, data: demandData })
      : await prisma.demands.create({ data: { request_id: d.request_id, created_by: amId, ...demandData } });
    demandByRequestId.set(d.request_id, row.id);

    for (const recEmail of d.recruiterEmails) {
      const taId = userByEmail.get(recEmail)!;
      await prisma.demand_ta_allocations.upsert({
        where: { demand_id_ta_id: { demand_id: row.id, ta_id: taId } },
        update: {},
        create: { demand_id: row.id, ta_id: taId },
      });
      const existingAssignment = await prisma.demand_assignments.findFirst({
        where: { demand_id: row.id, user_id: taId, role_in_demand: 'recruiter' },
      });
      if (!existingAssignment) {
        await prisma.demand_assignments.create({
          data: { demand_id: row.id, user_id: taId, role_in_demand: 'recruiter', assigned_by: amId, is_active: true },
        });
      }
    }

    const amAssignment = await prisma.demand_assignments.findFirst({ where: { demand_id: row.id, user_id: amProfileId, role_in_demand: 'account_manager' } });
    if (!amAssignment) {
      await prisma.demand_assignments.create({
        data: { demand_id: row.id, user_id: amProfileId, role_in_demand: 'account_manager', assigned_by: amId, is_active: true },
      });
    }
    if (spocProfileId) {
      const spocAssignment = await prisma.demand_assignments.findFirst({ where: { demand_id: row.id, user_id: spocProfileId, role_in_demand: 'spoc' } });
      if (!spocAssignment) {
        await prisma.demand_assignments.create({
          data: { demand_id: row.id, user_id: spocProfileId, role_in_demand: 'spoc', assigned_by: amId, is_active: true },
        });
      }
    }
  }

  console.log('Seeding candidates...');
  const candidateByEmail = new Map<string, string>();
  for (const c of CANDIDATES) {
    const existing = await prisma.candidates.findFirst({ where: { email: c.email } });
    const data = {
      full_name: c.full_name,
      email: c.email,
      phone: c.phone,
      skills: [...c.skills],
      current_location: c.current_location,
      preferred_locations: [c.current_location],
      current_company: c.current_company,
      current_designation: c.current_designation,
      total_experience: c.total_experience,
      current_ctc: dec(c.current_ctc),
      expected_ctc: dec(c.expected_ctc),
      source: c.source,
      availability: c.availability,
      added_by: userByEmail.get('karan.malhotra@costaff-demo.in'),
    };
    const row = existing
      ? await prisma.candidates.update({ where: { id: existing.id }, data })
      : await prisma.candidates.create({ data });
    candidateByEmail.set(c.email, row.id);
  }

  console.log('Seeding submissions (candidate <-> demand)...');
  // skill-matched pairings: candidate email -> [{ demandRequestId, status, recruiterEmail, strong }]
  type SubmissionSeed = { candidate: string; demandRequestId: string; status: string; recruiterEmail: string };
  const SUBMISSIONS: SubmissionSeed[] = [
    { candidate: 'aditya.kulkarni@dummymail.in', demandRequestId: 'CSF-DUMMY-0001', status: 'interview_scheduled', recruiterEmail: 'karan.malhotra@costaff-demo.in' },
    { candidate: 'diya.menon@dummymail.in', demandRequestId: 'CSF-DUMMY-0001', status: 'shortlisted_internal', recruiterEmail: 'karan.malhotra@costaff-demo.in' },
    { candidate: 'nikhil.bose@dummymail.in', demandRequestId: 'CSF-DUMMY-0001', status: 'sourced', recruiterEmail: 'karan.malhotra@costaff-demo.in' },

    { candidate: 'simran.kaur@dummymail.in', demandRequestId: 'CSF-DUMMY-0002', status: 'customer_shortlisted', recruiterEmail: 'ananya.das@costaff-demo.in' },
    { candidate: 'devansh.joshi@dummymail.in', demandRequestId: 'CSF-DUMMY-0002', status: 'sourced', recruiterEmail: 'ananya.das@costaff-demo.in' },
    { candidate: 'riya.saxena@dummymail.in', demandRequestId: 'CSF-DUMMY-0002', status: 'shortlist_reject', recruiterEmail: 'ananya.das@costaff-demo.in' },

    { candidate: 'isha.reddy@dummymail.in', demandRequestId: 'CSF-DUMMY-0003', status: 'sourced', recruiterEmail: 'karan.malhotra@costaff-demo.in' },
    { candidate: 'manish.agarwal@dummymail.in', demandRequestId: 'CSF-DUMMY-0003', status: 'sent_to_customer', recruiterEmail: 'ananya.das@costaff-demo.in' },
    { candidate: 'pooja.shetty@dummymail.in', demandRequestId: 'CSF-DUMMY-0003', status: 'shortlisted_internal', recruiterEmail: 'karan.malhotra@costaff-demo.in' },
    { candidate: 'harsh.vora@dummymail.in', demandRequestId: 'CSF-DUMMY-0003', status: 'interviewed', recruiterEmail: 'ananya.das@costaff-demo.in' },

    { candidate: 'kavya.pillai@dummymail.in', demandRequestId: 'CSF-DUMMY-0004', status: 'selected', recruiterEmail: 'ananya.das@costaff-demo.in' },
    { candidate: 'siddharth.rao@dummymail.in', demandRequestId: 'CSF-DUMMY-0004', status: 'interview_scheduled', recruiterEmail: 'ananya.das@costaff-demo.in' },
    { candidate: 'tanvi.bhatt@dummymail.in', demandRequestId: 'CSF-DUMMY-0004', status: 'sourced', recruiterEmail: 'ananya.das@costaff-demo.in' },

    { candidate: 'aryan.chawla@dummymail.in', demandRequestId: 'CSF-DUMMY-0005', status: 'onboarding', recruiterEmail: 'karan.malhotra@costaff-demo.in' },
    { candidate: 'meera.krishnan@dummymail.in', demandRequestId: 'CSF-DUMMY-0005', status: 'offer_accepted', recruiterEmail: 'karan.malhotra@costaff-demo.in' },
    { candidate: 'yash.trivedi@dummymail.in', demandRequestId: 'CSF-DUMMY-0005', status: 'sourced', recruiterEmail: 'karan.malhotra@costaff-demo.in' },

    // candidate reused across multiple demands (partial skill match scenario)
    { candidate: 'diya.menon@dummymail.in', demandRequestId: 'CSF-DUMMY-0003', status: 'sourced', recruiterEmail: 'karan.malhotra@costaff-demo.in' },
    { candidate: 'alisha.fernandes@dummymail.in', demandRequestId: 'CSF-DUMMY-0002', status: 'sourced', recruiterEmail: 'ananya.das@costaff-demo.in' },
  ];

  const submissionKey = (demandId: string, candidateId: string) => `${demandId}::${candidateId}`;
  const submissionByKey = new Map<string, string>();
  for (const s of SUBMISSIONS) {
    const demandId = demandByRequestId.get(s.demandRequestId)!;
    const candidateId = candidateByEmail.get(s.candidate)!;
    const addedBy = userByEmail.get(s.recruiterEmail)!;
    const existing = await prisma.submissions.findFirst({ where: { demand_id: demandId, candidate_id: candidateId } });
    const row = existing
      ? await prisma.submissions.update({
          where: { id: existing.id },
          data: { current_status: s.status, source: 'naukri', added_by: addedBy, is_active: !['rejected', 'dropped', 'backed_out', 'shortlist_reject'].includes(s.status) },
        })
      : await prisma.submissions.create({
          data: {
            demand_id: demandId,
            candidate_id: candidateId,
            current_status: s.status,
            source: 'naukri',
            added_by: addedBy,
            submitted_by_ta: addedBy,
            is_active: !['rejected', 'dropped', 'backed_out', 'shortlist_reject'].includes(s.status),
          },
        });
    submissionByKey.set(submissionKey(demandId, candidateId), row.id);
  }

  console.log('Seeding interviews...');
  type InterviewSeed = {
    candidate: string;
    demandRequestId: string;
    level: string;
    scheduled_date: string;
    scheduled_time: string;
    end_time: string;
    status: string;
    mode: string;
    scheduledByEmail: string;
    result?: 'pass' | 'fail' | 'on_hold';
    feedback?: string;
  };
  const INTERVIEWS: InterviewSeed[] = [
    { candidate: 'aditya.kulkarni@dummymail.in', demandRequestId: 'CSF-DUMMY-0001', level: 'L1', scheduled_date: '2026-10-08', scheduled_time: '11:00:00', end_time: '12:00:00', status: 'Scheduled', mode: 'Video', scheduledByEmail: 'karan.malhotra@costaff-demo.in' },
    { candidate: 'diya.menon@dummymail.in', demandRequestId: 'CSF-DUMMY-0001', level: 'L1', scheduled_date: '2026-09-25', scheduled_time: '15:00:00', end_time: '16:00:00', status: 'Completed', mode: 'Video', scheduledByEmail: 'karan.malhotra@costaff-demo.in', result: 'pass', feedback: 'Strong React fundamentals, good system design sense.' },

    { candidate: 'simran.kaur@dummymail.in', demandRequestId: 'CSF-DUMMY-0002', level: 'L1', scheduled_date: '2026-09-20', scheduled_time: '10:30:00', end_time: '11:30:00', status: 'Completed', mode: 'Video', scheduledByEmail: 'ananya.das@costaff-demo.in', result: 'pass', feedback: 'Solid Kafka and Spring Boot experience.' },
    { candidate: 'simran.kaur@dummymail.in', demandRequestId: 'CSF-DUMMY-0002', level: 'L2', scheduled_date: '2026-10-05', scheduled_time: '14:00:00', end_time: '15:00:00', status: 'Scheduled', mode: 'In-Person', scheduledByEmail: 'ananya.das@costaff-demo.in' },
    { candidate: 'riya.saxena@dummymail.in', demandRequestId: 'CSF-DUMMY-0002', level: 'L1', scheduled_date: '2026-09-18', scheduled_time: '09:00:00', end_time: '10:00:00', status: 'Completed', mode: 'Video', scheduledByEmail: 'ananya.das@costaff-demo.in', result: 'fail', feedback: 'Weak on distributed systems concepts.' },

    { candidate: 'manish.agarwal@dummymail.in', demandRequestId: 'CSF-DUMMY-0003', level: 'L1', scheduled_date: '2026-10-10', scheduled_time: '12:00:00', end_time: '13:00:00', status: 'Scheduled', mode: 'Video', scheduledByEmail: 'ananya.das@costaff-demo.in' },
    { candidate: 'harsh.vora@dummymail.in', demandRequestId: 'CSF-DUMMY-0003', level: 'L1', scheduled_date: '2026-09-22', scheduled_time: '16:00:00', end_time: '17:00:00', status: 'Completed', mode: 'Video', scheduledByEmail: 'ananya.das@costaff-demo.in', result: 'on_hold', feedback: 'Good fundamentals, client to confirm next steps.' },
    { candidate: 'pooja.shetty@dummymail.in', demandRequestId: 'CSF-DUMMY-0003', level: 'L1', scheduled_date: '2026-09-15', scheduled_time: '10:00:00', end_time: '11:00:00', status: 'Client No-Show', mode: 'Video', scheduledByEmail: 'karan.malhotra@costaff-demo.in' },

    { candidate: 'kavya.pillai@dummymail.in', demandRequestId: 'CSF-DUMMY-0004', level: 'L2', scheduled_date: '2026-09-28', scheduled_time: '11:00:00', end_time: '12:00:00', status: 'Completed', mode: 'Video', scheduledByEmail: 'ananya.das@costaff-demo.in', result: 'pass', feedback: 'Excellent pipeline design knowledge, cleared final round.' },
    { candidate: 'siddharth.rao@dummymail.in', demandRequestId: 'CSF-DUMMY-0004', level: 'L1', scheduled_date: '2026-10-09', scheduled_time: '13:00:00', end_time: '14:00:00', status: 'Scheduled', mode: 'Video', scheduledByEmail: 'ananya.das@costaff-demo.in' },

    { candidate: 'aryan.chawla@dummymail.in', demandRequestId: 'CSF-DUMMY-0005', level: 'Final', scheduled_date: '2026-09-10', scheduled_time: '10:00:00', end_time: '11:00:00', status: 'Completed', mode: 'Video', scheduledByEmail: 'karan.malhotra@costaff-demo.in', result: 'pass', feedback: 'Great infra automation experience; offer extended.' },
    { candidate: 'meera.krishnan@dummymail.in', demandRequestId: 'CSF-DUMMY-0005', level: 'Final', scheduled_date: '2026-09-05', scheduled_time: '15:30:00', end_time: '16:30:00', status: 'Completed', mode: 'In-Person', scheduledByEmail: 'karan.malhotra@costaff-demo.in', result: 'pass', feedback: 'Offer accepted, moving to onboarding.' },
    { candidate: 'yash.trivedi@dummymail.in', demandRequestId: 'CSF-DUMMY-0005', level: 'L1', scheduled_date: '2026-10-12', scheduled_time: '09:30:00', end_time: '10:30:00', status: 'Scheduled', mode: 'Phone', scheduledByEmail: 'karan.malhotra@costaff-demo.in' },

    { candidate: 'diya.menon@dummymail.in', demandRequestId: 'CSF-DUMMY-0003', level: 'L1', scheduled_date: '2026-09-12', scheduled_time: '12:30:00', end_time: '13:30:00', status: 'Candidate No-Show', mode: 'Video', scheduledByEmail: 'karan.malhotra@costaff-demo.in' },
  ];

  let interviewCount = 0;
  for (const iv of INTERVIEWS) {
    const demandId = demandByRequestId.get(iv.demandRequestId)!;
    const candidateId = candidateByEmail.get(iv.candidate)!;
    const submissionId = submissionByKey.get(submissionKey(demandId, candidateId));
    const scheduledBy = userByEmail.get(iv.scheduledByEmail)!;

    const existing = await prisma.interviews.findFirst({
      where: { demand_id: demandId, candidate_id: candidateId, level: iv.level, scheduled_date: new Date(iv.scheduled_date) },
    });
    const data = {
      demand_id: demandId,
      candidate_id: candidateId,
      submission_id: submissionId,
      level: iv.level,
      scheduled_date: new Date(iv.scheduled_date),
      scheduled_time: new Date(`1970-01-01T${iv.scheduled_time}Z`),
      end_time: new Date(`1970-01-01T${iv.end_time}Z`),
      status: iv.status,
      mode: iv.mode === 'In-Person' ? 'InPerson' : iv.mode === 'Phone' ? 'Video' : iv.mode === 'Video' ? 'Video' : 'Video',
      interview_location: iv.mode === 'Phone' || iv.mode === 'In-Person' ? 'Direct_Call' : 'Teams',
      interview_type: iv.level === 'Final' ? 'Managerial' : iv.level === 'L2' ? 'Functional' : 'Technical',
      scheduled_by: scheduledBy,
      created_by: scheduledBy,
      result: iv.result ?? null,
      feedback: iv.feedback ?? null,
      remark: iv.feedback ?? null,
    };
    if (existing) {
      await prisma.interviews.update({ where: { id: existing.id }, data });
    } else {
      await prisma.interviews.create({ data });
    }
    interviewCount += 1;
  }

  console.log('Seeding cap, onboarding, closure notes, and an unattached candidate...');
  const recruiterId = userByEmail.get('karan.malhotra@costaff-demo.in')!;
  const capDemandId = demandByRequestId.get('CSF-DUMMY-0006')!;
  for (let i = 1; i <= 7; i += 1) {
    const email = `cap.profile${i}@dummymail.in`;
    const existing = await prisma.candidates.findFirst({ where: { email } });
    const candidate = existing ?? await prisma.candidates.create({
      data: {
        full_name: `[TEST] Cap Profile ${i}`,
        email,
        phone: `+91981111020${i}`,
        skills: ['Java', 'Spring Boot'],
        current_location: 'Bangalore',
        current_company: '[TEST] Bench',
        total_experience: '4 years',
        source: 'naukri',
        added_by: recruiterId,
      },
    });
    const sourcingType = i <= 5 ? 'active' : 'backup';
    const existingSub = await prisma.submissions.findFirst({ where: { demand_id: capDemandId, candidate_id: candidate.id } });
    if (existingSub) {
      await prisma.submissions.update({
        where: { id: existingSub.id },
        data: { current_status: 'sourced', sourcing_type: sourcingType, is_active: true, source: 'naukri' },
      });
    } else {
      await prisma.submissions.create({
        data: {
          demand_id: capDemandId,
          candidate_id: candidate.id,
          current_status: 'sourced',
          sourcing_type: sourcingType,
          source: 'naukri',
          added_by: recruiterId,
          submitted_by_ta: recruiterId,
          is_active: true,
        },
      });
    }
  }

  const poolEmail = 'pool.unattached@dummymail.in';
  const poolExisting = await prisma.candidates.findFirst({ where: { email: poolEmail } });
  if (!poolExisting) {
    await prisma.candidates.create({
      data: {
        full_name: '[TEST] Unattached Candidate',
        email: poolEmail,
        phone: '+919811119999',
        skills: ['SQL'],
        current_location: 'Chennai',
        source: 'direct',
        added_by: userByEmail.get('arjun.sharma@costaff-demo.in'),
      },
    });
  }

  const onboardingDemandId = demandByRequestId.get('CSF-DUMMY-0005')!;
  const onboardingCandidateId = candidateByEmail.get('aryan.chawla@dummymail.in')!;
  const onboardingSubmission = await prisma.submissions.findFirst({
    where: { demand_id: onboardingDemandId, candidate_id: onboardingCandidateId },
  });
  if (onboardingSubmission) {
    const documents = [
      { name: 'Aadhaar', required: true, received: true, url: '' },
      { name: 'PAN', required: true, received: false, url: '' },
      { name: '[TEST] Offer letter', required: true, received: true, url: '' },
    ];
    const existingOnboarding = await prisma.onboardings.findFirst({ where: { submission_id: onboardingSubmission.id } });
    const onboardingData = {
      demand_id: onboardingDemandId,
      candidate_id: onboardingCandidateId,
      submission_id: onboardingSubmission.id,
      status: 'in_progress',
      bgv_status: 'in_progress',
      documents_status: documents,
      notes: '[TEST] Documents partially received.',
    };
    if (existingOnboarding) {
      await prisma.onboardings.update({ where: { id: existingOnboarding.id }, data: onboardingData });
    } else {
      await prisma.onboardings.create({ data: onboardingData });
    }
    const existingOffer = await prisma.offers.findFirst({ where: { submission_id: onboardingSubmission.id } });
    if (!existingOffer) {
      await prisma.offers.create({
        data: {
          submission_id: onboardingSubmission.id,
          demand_id: onboardingDemandId,
          candidate_id: onboardingCandidateId,
          offered_ctc: '1800000',
          status: 'Accepted',
          notes: '[TEST] Offer accepted.',
        },
      });
    }
  }

  const closureDemandId = demandByRequestId.get('CSF-DUMMY-0008')!;
  const closureRemark = '[TEST] Positions filled. Closing this demand.';
  const closureEvent = await prisma.demand_status_events.findFirst({
    where: { demand_id: closureDemandId, to_status: 'Closure' },
  });
  if (!closureEvent) {
    await prisma.demand_status_events.create({
      data: {
        demand_id: closureDemandId,
        from_status: 'Onboarding',
        to_status: 'Closure',
        remark: closureRemark,
        created_by: userByEmail.get('rohit.verma@costaff-demo.in'),
      },
    });
  }
  const closureOnboarding = await prisma.onboardings.findFirst({ where: { demand_id: closureDemandId } });
  if (!closureOnboarding) {
    const closureCandidate = candidateByEmail.get('alisha.fernandes@dummymail.in');
    if (closureCandidate) {
      const closureSub = await prisma.submissions.findFirst({ where: { demand_id: closureDemandId, candidate_id: closureCandidate } })
        ?? await prisma.submissions.create({
          data: {
            demand_id: closureDemandId,
            candidate_id: closureCandidate,
            current_status: 'joined',
            sourcing_type: 'active',
            source: 'linkedin',
            added_by: userByEmail.get('ananya.das@costaff-demo.in'),
            is_active: true,
          },
        });
      await prisma.onboardings.create({
        data: {
          demand_id: closureDemandId,
          candidate_id: closureCandidate,
          submission_id: closureSub.id,
          status: 'joined',
          bgv_status: 'clear',
          closure_feedback: closureRemark,
          closed_at: new Date(),
          documents_status: [{ name: '[TEST] Relieving letter', required: false, received: true, url: '' }],
        },
      });
    }
  }

  const panelCandidate = candidateByEmail.get('siddharth.rao@dummymail.in')!;
  const panelDemand = demandByRequestId.get('CSF-DUMMY-0004')!;
  const panelExisting = await prisma.interviews.findFirst({
    where: { demand_id: panelDemand, candidate_id: panelCandidate, status: 'Panel No-Show' },
  });
  if (!panelExisting) {
    const panelSub = await prisma.submissions.findFirst({ where: { demand_id: panelDemand, candidate_id: panelCandidate } });
    await prisma.interviews.create({
      data: {
        demand_id: panelDemand,
        candidate_id: panelCandidate,
        submission_id: panelSub?.id,
        level: 'L1',
        scheduled_date: new Date('2026-10-02'),
        scheduled_time: new Date('1970-01-01T16:00:00Z'),
        end_time: new Date('1970-01-01T17:00:00Z'),
        status: 'Panel No-Show',
        mode: 'Video',
        interview_type: 'Technical',
        interview_location: 'Teams',
        remark: '[TEST] Panel did not join.',
        created_by: userByEmail.get('ananya.das@costaff-demo.in'),
        scheduled_by: userByEmail.get('ananya.das@costaff-demo.in'),
      },
    });
  }

  for (const demandId of demandByRequestId.values()) {
    const round = await prisma.demand_interview_rounds.findFirst({ where: { demand_id: demandId, round_order: 1 } });
    const roundRow = round ?? await prisma.demand_interview_rounds.create({
      data: { demand_id: demandId, name: 'Technical', round_order: 1, mandatory: false, mode: 'Video' },
    });
    await prisma.interviews.updateMany({
      where: { demand_id: demandId, round_id: null },
      data: { round_id: roundRow.id },
    });
    const eventCount = await prisma.demand_assignment_events.count({ where: { demand_id: demandId } });
    if (eventCount === 0) {
      const demand = await prisma.demands.findUnique({ where: { id: demandId }, select: { spoc_profile_id: true, contact_profile_id: true } });
      if (demand?.spoc_profile_id) {
        await prisma.demand_assignment_events.create({
          data: {
            demand_id: demandId,
            category: 'costaff_spoc',
            action: 'assign',
            subject_id: demand.spoc_profile_id,
            created_by: demand.contact_profile_id,
          },
        });
      }
    }
  }

  console.log('\n--- Seed summary ---');
  console.log(`Users: ${USERS.length}`);
  console.log(`Demands: ${DEMANDS.length}`);
  console.log(`Candidates: ${CANDIDATES.length}`);
  console.log(`Submissions (candidate<->demand): ${SUBMISSIONS.length}`);
  console.log(`Interviews: ${interviewCount}`);
  console.log('Demo user emails use @costaff-demo.in. Candidate emails use @dummymail.in. Request ids start with CSF-DUMMY-.');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
