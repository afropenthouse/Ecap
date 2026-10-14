const {test}=require('node:test');const assert=require('node:assert/strict');
const {app,tables,tokenFor}=require('./assessment-test-app.cjs');
test('real assessment and performance route lifecycle against isolated data',async t=>{
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 const request=(path,role='employee',method='GET',body)=>fetch(`http://127.0.0.1:${server.address().port}/api${path}`,{method,headers:{'Content-Type':'application/json',Authorization:`Bearer ${tokenFor(role)}`},...(body?{body:JSON.stringify(body)}:{})});
 const json=async(path,role,method,body,status=200)=>{const response=await request(path,role,method,body);assert.equal(response.status,status,await response.clone().text());return response.json();};
 let self,assessor,appraisal,assessorAppraisal;
 try{
  await t.test('self assessment validates ratings and blocks premature completion',async()=>{
   assert.equal((await request('/assessments/assessor','assessor','POST',{employeeId:'employee'})).status,409);
   self=await json('/assessments/self','employee','POST',{},201);
   assert.equal((await request(`/assessments/${self.id}/status`,'employee','PUT',{status:'COMPLETED'})).status,409);
   for(const body of [{competencyId:[],rating:2},{competencyId:'communication',rating:1.5},{competencyId:'communication',rating:0},{competencyId:'communication',rating:2,comment:{}},{competencyId:'communication',rating:2,comment:'x'.repeat(2001)},{competencyId:'foreign',rating:2}])assert.equal((await request(`/assessments/${self.id}/ratings`,'employee','POST',body)).status,400);
   assert.equal((await request(`/assessments/${self.id}/ratings`,'hr','POST',{competencyId:'communication',rating:2})).status,403);
   await json(`/assessments/${self.id}/status`,'employee','PUT',{status:'IN_PROGRESS'});
   await Promise.all(['communication','planning'].map(competencyId=>json(`/assessments/${self.id}/ratings`,'employee','POST',{competencyId,rating:2,comment:'Employee evidence'})));
   await json(`/assessments/${self.id}/ratings`,'employee','POST',{competencyId:'communication',rating:2,comment:'Updated evidence'});
   assert.equal(tables.assessmentRating.filter(row=>row.assessmentId===self.id).length,2);
   await json(`/assessments/${self.id}/status`,'employee','PUT',{status:'COMPLETED'});
   assert.equal((await request(`/assessments/${self.id}/ratings`,'employee','POST',{competencyId:'communication',rating:2})).status,409);
  });
  await t.test('assessor handoff, required ratings and persisted consensus average',async()=>{
   assessor=tables.assessment.find(row=>row.type==='ASSESSOR');assert.ok(assessor);
   assert.equal((await request(`/assessments/${assessor.id}/ratings`,'employee','POST',{competencyId:'communication',rating:4})).status,403);
   assert.equal((await request('/assessments/consensus/employee','hr','POST',{})).status,409);
   for(const competencyId of ['communication','planning'])await json(`/assessments/${assessor.id}/ratings`,'assessor','POST',{competencyId,rating:3,comment:'Assessor evidence'});
   await json(`/assessments/${assessor.id}/status`,'assessor','PUT',{status:'REVIEWED'});
   const consensus=await json('/assessments/consensus/employee','hr','POST',{});
   assert.equal(consensus.ratings.length,2);assert.ok(consensus.ratings.every(row=>row.rating===2.5));
   const repeated=await json('/assessments/consensus/employee','hr','POST',{});assert.equal(repeated.id,consensus.id);
   assert.equal((await request('/assessments/consensus/employee','assessor','POST',{})).status,403);
  });
  await t.test('a new self assessment cannot reuse a prior completed assessor cycle',async()=>{
   const next=await json('/assessments/self','employee','POST',{},201);
   for(const competencyId of ['communication','planning'])await json(`/assessments/${next.id}/ratings`,'employee','POST',{competencyId,rating:4});
   await json(`/assessments/${next.id}/status`,'employee','PUT',{status:'COMPLETED'});
   const current=tables.assessment.filter(row=>row.type==='ASSESSOR').at(-1);assert.notEqual(current.id,assessor.id);
   assert.equal((await request('/assessments/consensus/employee','hr','POST',{})).status,409);
  });
  await t.test('performance self appraisal rejects invalid input and requires all answers',async()=>{
   appraisal=await json('/appraisals/self','employee','POST',{},201);
   assert.equal((await request(`/appraisals/${appraisal.id}/status`,'employee','PUT',{status:'PENDING'})).status,400);
   assert.equal((await request(`/appraisals/${appraisal.id}/status`,'employee','PUT',{status:'COMPLETED'})).status,409);
   for(const body of [{questionId:[],rating:3},{questionId:tables.performanceAppraisalQuestion[0]?.id || 'missing',rating:6},{questionId:tables.performanceAppraisalQuestion[0]?.id || 'missing',rating:2,comment:[]},{questionId:tables.performanceAppraisalQuestion[0]?.id || 'missing',rating:2,comment:'x'.repeat(2001)}])assert.equal((await request(`/appraisals/${appraisal.id}/responses`,'employee','POST',body)).status,400);
   await json(`/appraisals/${appraisal.id}/status`,'employee','PUT',{status:'IN_PROGRESS'});
   for(const question of tables.performanceAppraisalQuestion)await json(`/appraisals/${appraisal.id}/responses`,'employee','POST',{questionId:question.id,rating:4,comment:'Employee performance evidence'});
   await json(`/appraisals/${appraisal.id}/responses`,'employee','POST',{questionId:tables.performanceAppraisalQuestion[0]?.id || 'missing',rating:4,comment:'Revised'});
   assert.equal(tables.performanceAppraisalResponse.filter(row=>row.appraisalId===appraisal.id).length,tables.performanceAppraisalQuestion.length);
   await json(`/appraisals/${appraisal.id}/status`,'employee','PUT',{status:'COMPLETED'});
  });
  await t.test('assessor performance appraisal and HR review preserve ownership',async()=>{
   assessorAppraisal=tables.performanceAppraisal.find(row=>row.type==='ASSESSOR');assert.ok(assessorAppraisal);
   const selfAnswers=await json(`/appraisals/${appraisal.id}/responses`,'assessor');assert.equal(selfAnswers.length,tables.performanceAppraisalQuestion.length);
   assert.equal((await request(`/appraisals/${appraisal.id}/responses`,'assessor','POST',{questionId:tables.performanceAppraisalQuestion[0]?.id || 'missing',rating:3})).status,409);
   assert.equal((await request(`/appraisals/${assessorAppraisal.id}/responses`,'hr','POST',{questionId:tables.performanceAppraisalQuestion[0]?.id || 'missing',rating:3})).status,403);
   for(const question of tables.performanceAppraisalQuestion)await json(`/appraisals/${assessorAppraisal.id}/responses`,'assessor','POST',{questionId:question.id,rating:3,comment:'Assessor performance evidence'});
   await json(`/appraisals/${assessorAppraisal.id}/status`,'assessor','PUT',{status:'COMPLETED'});
   await json(`/appraisals/${assessorAppraisal.id}/status`,'hr','PUT',{status:'REVIEWED'});
   const overview=await json('/appraisals','hr');
   assert.equal(overview.find(row=>row.id===appraisal.id).averageRating,4);
   assert.equal(overview.find(row=>row.id===assessorAppraisal.id).averageRating,3);
   assert.equal((await request(`/appraisals/${assessorAppraisal.id}/responses`,'employee')).status,403);
  });
  await t.test('new performance cycles do not reuse an older unfinished assessor appraisal',async()=>{
   tables.performanceAppraisal.push({id:'stale-assessor',organizationId:'test-organization',employeeId:'employee',assessorId:'assessor',type:'ASSESSOR',status:'PENDING',createdAt:new Date('2024-01-01')});
   const next = await json('/appraisals/self','employee','POST',{},201);
   for(const question of tables.performanceAppraisalQuestion)await json('/appraisals/'+next.id+'/responses','employee','POST',{questionId:question.id,rating:4});
   await json('/appraisals/'+next.id+'/status','employee','PUT',{status:'COMPLETED'});
   const assigned = tables.performanceAppraisal.filter(row=>row.type==='ASSESSOR' && row.createdAt >= new Date(next.createdAt));
   assert.equal(assigned.length,1); assert.notEqual(assigned[0].id,'stale-assessor');
  });
 }finally{await new Promise(resolve=>server.close(resolve));}
});
