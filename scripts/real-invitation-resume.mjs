// Fail closed when a browser interruption makes the send outcome uncertain.
export function invitationRunAction({state,items,email}){
  const matches=items.filter(item=>item.email===email);
  if(matches.length>1)throw new Error('CURRENT_INVITATION_NOT_UNIQUE');
  const row=matches[0];
  if(!state.issuedAt&&!state.invited){
    if(items.length)throw new Error('UNTRACKED_INVITATION_EXISTS');
    return 'issue';
  }
  if(!row||row.deliveryStatus!=='captured'||!state.issuedAt||Date.parse(row.createdAt)<Date.parse(state.issuedAt))throw new Error('INVITATION_OUTCOME_UNKNOWN_NO_AUTORETRY');
  return 'reuse';
}
