// Shared by the composer and Hub input boundaries; never shorten user text.
export const AGENT_QUESTION_MAX_CHARACTERS=4000;
export const agentQuestionLength=text=>typeof text==='string'?[...text.trim()].length:0;
export function agentQuestionError(text){
 const length=agentQuestionLength(text);
 if(typeof text!=='string'||length<2)return '请输入至少2个字符的研究问题。';
 return length>AGENT_QUESTION_MAX_CHARACTERS?'研究问题最多4000个字符；内容已保留，请缩短后再发送或保存。':'';
}
