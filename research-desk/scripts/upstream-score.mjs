export function scoreLifetime(expected, text) {
  let answer, strictFormat=true;
  try { answer=JSON.parse(text); }
  catch { strictFormat=false;const match=text.trim().match(/^```json\s*\n([\s\S]*?)\n```$/);if(match)answer=JSON.parse(match[1]); }
  const scenarioScores={};
  for(const [name,want]of Object.entries(expected)){
    const actual=answer?.[name];
    const correct=actual!==null&&typeof actual==='object'&&!Array.isArray(actual)&&Object.keys(actual).length===Object.keys(want).length&&Object.keys(want).every(k=>JSON.stringify(actual[k])===JSON.stringify(want[k]));
    scenarioScores[name]={correct,expected:want,actual};
  }
  const correctScenarios=Object.values(scenarioScores).filter(s=>s.correct).length;
  const exactRoot=answer!==null&&typeof answer==='object'&&!Array.isArray(answer)&&Object.keys(answer).length===Object.keys(expected).length;
  return {strictFormat,secondaryFenceRemoval:!strictFormat&&Boolean(answer),scenarioScores,correctScenarios,semanticSuccess:exactRoot&&correctScenarios===Object.keys(expected).length,success:strictFormat&&exactRoot&&correctScenarios===Object.keys(expected).length};
}
