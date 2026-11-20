const stop=new Set(['请问','请','根据','依据','说明','解释','什么','哪些','怎么','如何','是否','需要','这些','这份','当前','资料','材料','一下','支持','有关','以及','可以','the','and','what','which','how','does','this','these','with','from','please','explain','are']);
const segmenter=new Intl.Segmenter('zh',{granularity:'word'});
// Native keyword retrieval splits on spaces. Segment the actual question once;
// retain the question for synthesis and record the exact executed query.
export function compileKnowledgeQuery(original){
 if(typeof original!=='string')throw Error('KNOWLEDGE_QUERY_INVALID');
 const terms=[];
 for(const item of segmenter.segment(original)){
  const term=item.segment.toLowerCase();
  if(item.isWordLike&&term.length>=2&&!stop.has(term)&&!terms.includes(term)){terms.push(term);if(terms.length===6)break;}
 }
 return{original,terms,query:terms.join(' '),policy:'native-keyword-unicode-word-v1',icu:process.versions.icu};
}
