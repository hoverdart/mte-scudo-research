export async function requirePasswordSession(){
  try{
    const response=await fetch('/api/password/session',{cache:'no-store'});
    const session=response.ok?await response.json():null;
    if(session?.authenticated){
      document.addEventListener('DOMContentLoaded',()=>addAccount(session),{once:true});
      if(document.readyState!=='loading')addAccount(session);
      return session;
    }
  }catch{/* Offer the login screen when the session cannot be confirmed. */}
  const next=location.pathname+location.search+location.hash;
  location.replace('/login.html?returnTo='+encodeURIComponent(next));
  return null;
}
function addAccount(session){
  if(document.querySelector('#password-account'))return;
  const footer=document.querySelector('.sidebar-bottom');if(!footer)return;
  const account=document.createElement('p');account.id='password-account';account.textContent='Password session · 24 hours';
  const signout=document.createElement('a');signout.href='/logout.html';signout.textContent='Sign out';signout.className='sidebar-action';
  footer.append(account,signout);
}
