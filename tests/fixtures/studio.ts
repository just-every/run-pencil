export function studioForm(study=false){
 const completion={key:'synthetic-pencil-4',kind:'completion',questionType:null,prompt:'Thank you',required:false,choices:[] as string[],scale:null,next:null}
 if(study)return {title:'Generated onboarding study',steps:[
  {key:'synthetic-pencil-1',kind:'question',questionType:'yes_no',prompt:"Don't you agree our onboarding is excellent?",required:true,choices:[],scale:null,next:'synthetic-pencil-2'},
  {key:'synthetic-pencil-2',kind:'question',questionType:'long_text',prompt:'How satisfied are you with speed and price?',required:false,choices:[],scale:null,next:'synthetic-pencil-3'},
  {key:'synthetic-pencil-3',kind:'question',questionType:'single_choice',prompt:'Why are our employees so lazy?',required:false,choices:['Great','Good','Excellent'],scale:null,next:'synthetic-pencil-4'},completion,
 ],branches:[],study:{decision:'Choose the next onboarding improvement',hypotheses:['Unclear setup prevents activation'],audience:'Trial users',channel:'In-product survey',analysisPlan:'Compare task difficulty and written comments'},flags:[]}
 return {title:'Generated feedback form',steps:[
  {key:'synthetic-pencil-1',kind:'question',questionType:'single_choice',prompt:'Which area needs attention?',required:true,choices:['Onboarding','Billing'],scale:null,next:'synthetic-pencil-2'},
  {key:'synthetic-pencil-2',kind:'question',questionType:'long_text',prompt:'What would you like to improve?',required:false,choices:[],scale:null,next:'synthetic-pencil-4'},completion,
 ],branches:[{source:'synthetic-pencil-1',destination:'synthetic-pencil-4',predicate:'equals',choiceIndex:1,numberValue:null,booleanValue:null}],study:null,flags:[]}
}
