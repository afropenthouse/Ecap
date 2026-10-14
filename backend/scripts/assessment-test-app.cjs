// Isolated in-memory database for exercising the real assessment/appraisal routes.
// Never connects to the configured application database or sends email.
const express = require('express');
const jwt = require('jsonwebtoken');
const fs = require('node:fs');
const path = require('node:path');
const org = 'test-organization';
const users = ['EMPLOYEE','ASSESSOR','HR'].map(role => ({ id:role.toLowerCase(), role, organizationId:org, isActive:true, firstName:'Test', lastName:role.toLowerCase(), email:`${role.toLowerCase()}@test.invalid`, onboardingCompleted:true }));
let sequence=0;
const tables = {
  assessment:[], assessmentRating:[], performanceAppraisal:[], performanceAppraisalResponse:[],
  assessorAssignment:[{id:'assessor-link',organizationId:org,employeeId:'employee',assessorId:'assessor'}],
  competency:[{id:'communication',organizationId:org,name:'Communication'},{id:'planning',organizationId:org,name:'Planning'}],
  proficiencyLevel:[], user:users,
  employeeJobAssignment:[{id:'job-link',organizationId:org,employeeId:'employee',jobId:'test-job',startDate:new Date('2024-01-01'),createdAt:new Date('2024-01-01')}],
  performanceAppraisalQuestion:[],
};
const keys = [...fs.readFileSync(path.join(__dirname,'../src/routes/appraisals.ts'),'utf8').matchAll(/key: ['"]([^'"]+)['"]/g)].map(match=>match[1]);
for(const [i,key] of keys.entries()) tables.performanceAppraisalQuestion.push({id:`question-${i+1}`,key,organizationId:org,title:`Test performance question ${i+1}`,howToMeasure:'Use evidence from your work.',ratingCriteria:'1 to 5',order:i+1});
const requirements = tables.competency.map(comp=>({id:`requirement-${comp.id}`,organizationId:org,jobId:'test-job',competencyId:comp.id,requiredLevel:3}));
const job = {id:'test-job',organizationId:org,title:'Test Analyst',departmentId:'test-department',department:{id:'test-department',name:'Test Department'},requirements};
function match(row,where={}) {
  return Object.entries(where).every(([key,value]) => {
    if(value===undefined)return true;
    if(key==='OR')return value.some(condition=>match(row,condition));
    if(value&&typeof value==='object'&&!(value instanceof Date)) {
      if('in' in value)return value.in.includes(row[key]);
      if('notIn' in value)return !value.notIn.includes(row[key]);
      if('not' in value)return row[key]!==value.not;
      if('gte' in value)return value.gte===undefined||row[key]>=value.gte;
      if('lte' in value)return row[key]!=null&&row[key]<=value.lte;
      return Object.entries(value).every(([nested,nestedValue])=>row[nested]===nestedValue);
    }
    return row[key]===value;
  });
}
function decorate(name,row,include) {
  if(!row)return null;
  const result={...row};
  if(include?.ratings)result.ratings=tables.assessmentRating.filter(rating=>rating.assessmentId===row.id);
  if(include?.responses)result.responses=tables.performanceAppraisalResponse.filter(response=>response.appraisalId===row.id);
  if(include?.employee)result.employee=users.find(user=>user.id===row.employeeId);
  if(include?.assessor)result.assessor=users.find(user=>user.id===row.assessorId);
  if(include?.job)result.job=job;
  return result;
}
function model(name) { return {
  findMany:async({where,include,orderBy}={})=>{
    const result=tables[name].filter(row=>match(row,where));
    const orders=orderBy?Array.isArray(orderBy)?orderBy:[orderBy]:[];
    result.sort((a,b)=>{for(const order of orders){const [key,direction]=Object.entries(order)[0];let comparison=(a[key]>b[key]?1:a[key]<b[key]?-1:0);if(direction==='desc'||direction.sort==='desc')comparison*=-1;if(comparison)return comparison;}return 0;});
    return result.map(row=>decorate(name,row,include));
  },
  findFirst:async args=>(await mock[name].findMany(args))[0]||null,
  findUnique:async({where,include})=>decorate(name,tables[name].find(row=>match(row,where)),include),
  count:async({where}={})=>tables[name].filter(row=>match(row,where)).length,
  create:async({data,include})=>{const row={id:`${name}-${++sequence}`,createdAt:new Date(Date.now()-100000+sequence),assessorId:null,...data};tables[name].push(row);return decorate(name,row,include);},
  createMany:async({data})=>{let count=0;for(const entry of data){await mock[name].create({data:entry});count++;}return{count};},
  update:async({where,data,include})=>{const row=tables[name].find(row=>match(row,where));if(!row)throw new Error('Fixture record missing');Object.assign(row,Object.fromEntries(Object.entries(data).filter(([,value])=>value!==undefined)));return decorate(name,row,include);},
  upsert:async({where,create,update,include})=>{const row=tables[name].find(row=>match(row,where));return row?mock[name].update({where:{id:row.id},data:update,include}):mock[name].create({data:create,include});},
  deleteMany:async({where})=>{const before=tables[name].length;tables[name]=tables[name].filter(row=>!match(row,where));return{count:before-tables[name].length};},
};}
const mock={};for(const name of Object.keys(tables))mock[name]=model(name);
mock.$transaction=async fn=>fn(mock);
const config=require.resolve('../dist/config/prisma');require.cache[config]={id:config,filename:config,loaded:true,exports:{prisma:mock}};
process.env.JWT_SECRET='isolated-assessment-fixture-secret';
const app=express();
app.use((req,res,next)=>{res.set('Access-Control-Allow-Origin','http://localhost:5175');res.set('Access-Control-Allow-Headers','Content-Type,Authorization,Cache-Control,Pragma');res.set('Access-Control-Allow-Methods','GET,POST,PUT,DELETE,OPTIONS');if(req.method==='OPTIONS')return res.sendStatus(204);next();});
app.use(express.json());
const tokenFor=id=>jwt.sign({id,role:users.find(user=>user.id===id).role,organizationId:org},process.env.JWT_SECRET);
const organization={id:org,name:'Assessment Test Workspace',logoUrl:null};
app.post('/api/auth/login',(req,res)=>{const user=users.find(user=>user.email===req.body.email);if(!user||req.body.password!=='TestPassword1!')return res.status(401).json({error:'Invalid test login'});res.json({token:tokenFor(user.id),user,organization});});
app.get('/api/auth/me',(req,res)=>{try{const payload=jwt.verify((req.headers.authorization||'').replace('Bearer ',''),process.env.JWT_SECRET);res.json(users.find(user=>user.id===payload.id));}catch{res.sendStatus(401);}});
app.get('/api/organizations/public',(_req,res)=>res.json([organization]));
app.get('/api/organizations/me',(_req,res)=>res.json(organization));
app.get('/api/users',(_req,res)=>res.json(users));
app.get('/api/users/:id',(req,res)=>res.json(users.find(user=>user.id===req.params.id)));
app.get('/api/departments',(_req,res)=>res.json([job.department]));
app.get('/api/jobs',(_req,res)=>res.json([job]));
app.get('/api/competencies',(_req,res)=>res.json(tables.competency));
app.get('/api/competencies/levels',(_req,res)=>res.json(tables.proficiencyLevel));
app.get('/api/assignments',(_req,res)=>res.json(tables.assessorAssignment));
app.use('/api/job-assignments',require('../dist/routes/employeeJobAssignments').default);
app.use('/api/assessments',require('../dist/routes/assessments').default);
app.use('/api/appraisals',require('../dist/routes/appraisals').default);
if (require.main === module && process.env.ASSESSMENT_FIXTURE_STATE) {
  const state = JSON.parse(fs.readFileSync(process.env.ASSESSMENT_FIXTURE_STATE, 'utf8'));
  for (const [table, rows] of Object.entries(state)) {
    tables[table] = rows.map(row => {
      for (const field of ['createdAt', 'startedAt', 'completedAt']) if (row[field]) row[field] = new Date(row[field]);
      return row;
    });
  }
  sequence = 1000;
}
module.exports={app,tables,mock,tokenFor,users};
if(require.main===module)app.listen(4015,'127.0.0.1',()=>console.log('Isolated assessment fixture listening on http://localhost:4015; no real database is used.'));
