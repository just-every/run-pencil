export const questionGroupDefinition = (kind: 'group' | 'inline_group' = 'group') => ({
  id:`team-intake-${kind}`, title:'Team consultation',
  fields:[{ref:'team',type:kind,title:'Your team',properties:{description:'Tell us about the people who will use the service.',fields:[
    {ref:'name',type:'short_text',title:'Your name',validations:{required:true}},
    {ref:'size',type:'number',title:'Team size',validations:{required:false}},
    {ref:'decision',type:'yes_no',title:'Ready to talk?',validations:{required:false}},
  ]}}],
  thankyou_screens:[{ref:'thanks',title:'Request received'}],
})
