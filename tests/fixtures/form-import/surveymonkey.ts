// Synthetic resources in SurveyMonkey's API v3 survey-details / responses-bulk shape.
// Optional mask/regex fields exercise the explicit text-validation projection.
export const surveyMonkeyDetails = {
  id:'synthetic-pencil-100',title:'Synthetic business intake',custom_variables:{plan:'Plan'},pages:[{id:'synthetic-pencil-101',questions:[
    {id:'synthetic-pencil-102',family:'presentation',subtype:'descriptive_text',headings:[{heading:'Welcome to the synthetic study'}]},
    {id:'synthetic-pencil-103',family:'open_ended',subtype:'single',headings:[{heading:'Your reference code'}],required:true,validation:{type:'text_length',min:8,max:8,mask:'###-####',regex:'[0-9]{3}-[0-9]{4}',text:'Use a seven-digit reference with a hyphen.'}},
    {id:'synthetic-pencil-104',family:'single_choice',subtype:'vertical',headings:[{heading:'Which option fits?'}],answers:{choices:[{id:'synthetic-pencil-105',text:'Blue'},{id:'synthetic-pencil-106',text:'Green'}],other:{id:'synthetic-pencil-107',text:'Other (please specify)',is_answer_choice:true}}},
    {id:'synthetic-pencil-108',family:'matrix',subtype:'rating',headings:[{heading:'How helpful was this?'}],answers:{rows:[{id:'synthetic-pencil-109',text:'Helpfulness'}],choices:Array.from({length:7},(_,weight)=>({id:`synthetic-pencil-${110+weight}`,text:weight===0?'Not at all':weight===3?'Neutral':weight===6?'Completely':String(weight),weight}))}},
    {id:'synthetic-pencil-120',family:'matrix',subtype:'single',headings:[{heading:'Unsupported matrix'}],answers:{rows:[{id:'synthetic-pencil-121',text:'One'},{id:'synthetic-pencil-122',text:'Two'}],choices:[{id:'synthetic-pencil-123',text:'Yes'}]}},
    {id:'synthetic-pencil-124',family:'presentation',subtype:'descriptive_text',headings:[{heading:'Later descriptive text'}]},
  ]}]}
export const surveyMonkeyResponses = {total:1,data:[{id:'synthetic-pencil-200',survey_id:surveyMonkeyDetails.id,collector_id:'synthetic-pencil-201',response_status:'completed',date_created:'2026-10-20T09:00:00Z',date_modified:'2026-10-20T09:05:00Z',custom_variables:{plan:'enterprise'},pages:[{id:'synthetic-pencil-101',questions:[
  {id:'synthetic-pencil-103',answers:[{text:'555-0100'}]},
  {id:'synthetic-pencil-104',answers:[{choice_id:'synthetic-pencil-107',text:'Blue'}]},
  {id:'synthetic-pencil-108',answers:[{row_id:'synthetic-pencil-109',choice_id:'synthetic-pencil-110'}]},
  {id:'synthetic-pencil-120',answers:[{row_id:'synthetic-pencil-121',choice_id:'synthetic-pencil-123'}]},
]}]}]}
