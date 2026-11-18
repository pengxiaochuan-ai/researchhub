// Independently hand-transcribed expectations, not output of the tested builder.
export function inputGolden(){
 const pico={question:'合成配置能否用于软件核对？',p:'合成对象',i:'合成干预',c:'合成对照',o:'合成观察'};
 const config={label:'合成采集测试配置',outcomes:[{key:'signal',label:'软件观察值',definition:'合成软件验证，不是临床量表',unit:'软件单位'}],
  visits:[{key:'baseline',name:'合成基线',order:1,targetDayOffset:null,windowBeforeDays:null,windowAfterDays:null},{key:'followup',name:'合成随访',order:2,targetDayOffset:null,windowBeforeDays:null,windowAfterDays:null}],
  form:{key:'crf',name:'合成记录表',schema:{schemaVersion:'form-schema.v1',fields:[{key:'value',label:'软件数值',type:'number',required:true,min:0,max:10},{key:'flag',label:'模拟确认',type:'boolean',required:true},{key:'choice',label:'模拟类别',type:'select',required:false,options:[{value:'a',label:'测试类别'}]},{key:'note',label:'合成说明',type:'text',required:false}]}},
  mappings:[{outcomeKey:'signal',fieldKey:'value',visitKeys:['baseline','followup'],unit:'软件单位'}],missingStates:['missing','not_measured','not_applicable']};
 return structuredClone({schema:'rh-asset-applicability-input.v1',source:{pico,config,method:{executor:'research-data-quality',workerVersion:'t19-1',adapterVersion:'crf-quality-adapter.v1'},coverage:{scope:'own_synthetic_packet',included:['missing-rate','range-check','own_packet_counts'],notExamined:['enrollment','scales','files','time_order','leakage','duplicate_timestamp','group_balance','repeated_measure_inference','study_completeness','analysis_release'],rangeRule:'explicit_manual_config_only'}},target:{pico,config,confirmationStatus:'original_confirmation',derivedFrom:null}});
}
