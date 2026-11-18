export function createHubSkillController({require,skills}){
 const {Controller,Get,Req,HttpException}=require('@nestjs/common');
 class HubSkillController{
  async list(req){
   req.res?.setHeader('Cache-Control','no-store');
   if(Object.keys(req.query??{}).length)throw new HttpException({code:'HUB_SKILL_QUERY_INVALID',message:'请求参数无效。'},400);
   try{return await skills.list(req.user);}catch(error){
    const denied=error.code==='HUB_SKILL_ACCESS_DENIED';
    throw new HttpException({code:denied?'HUB_SKILL_ACCESS_DENIED':'HUB_SKILL_CATALOG_UNAVAILABLE',message:denied?'当前账号无法查看技能目录。':'技能目录暂时不可用，请稍后重试。'},denied?403:503);
   }
  }
 }
 Controller('qiyan-ai')(HubSkillController);
 Get('skills')(HubSkillController.prototype,'list',Object.getOwnPropertyDescriptor(HubSkillController.prototype,'list'));
 Req()(HubSkillController.prototype,'list',0);
 return HubSkillController;
}
