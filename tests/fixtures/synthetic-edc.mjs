export function syntheticEdcConfig(){return{
 label:'合成采集测试配置',outcomes:[{key:'signal',label:'软件观察值',definition:'合成软件验证，不是临床量表',unit:'软件单位'}],
 visits:[{key:'baseline',name:'合成基线',order:1,targetDayOffset:null,windowBeforeDays:null,windowAfterDays:null},{key:'followup',name:'合成随访',order:2,targetDayOffset:null,windowBeforeDays:null,windowAfterDays:null}],
 form:{key:'crf',name:'合成记录表',schema:{schemaVersion:'form-schema.v1',fields:[{key:'value',label:'软件数值',type:'number',required:true,min:0,max:10},{key:'flag',label:'模拟确认',type:'boolean',required:true},{key:'choice',label:'模拟类别',type:'select',required:false,options:[{value:'a',label:'测试类别'}]},{key:'note',label:'合成说明',type:'text',required:false}]}},
 mappings:[{outcomeKey:'signal',fieldKey:'value',visitKeys:['baseline','followup'],unit:'软件单位'}],missingStates:['missing','not_measured','not_applicable'],notes:''
};}
