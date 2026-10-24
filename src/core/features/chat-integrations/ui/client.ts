export async function chatRequest<T>(path:string,method='GET',body?:unknown):Promise<T>{
  const response=await fetch(path,{method,credentials:'same-origin',...(body===undefined?{}:{headers:{'content-type':'application/json'},body:JSON.stringify(body)})})
  const data=response.status===204?{}:await response.json() as {message?:string}
  if(!response.ok)throw new Error((data as {message?:string}).message??'Chat settings could not be saved.')
  return data as T
}
