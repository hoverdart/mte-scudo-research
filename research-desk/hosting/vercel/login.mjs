const status=document.querySelector('#login-status');
const button=document.querySelector('#password-submit');
const params=new URLSearchParams(location.search);
const logout=location.pathname==='/logout.html';
try{
  const configResponse=await fetch('/api/config',{cache:'no-store'});
  if(!configResponse.ok)throw new Error('Sign-in could not be loaded. Reload this page to try again.');
  const config=await configResponse.json();
  if(!config.configured)throw new Error('The site password has not been set yet. Please check back shortly.');
  const response=await fetch('/api/password/csrf',{cache:'no-store'});
  if(!response.ok)throw new Error('Sign-in could not be loaded. Reload this page to try again.');
  const {csrfToken}=await response.json();if(!csrfToken)throw new Error('Reload this page to prepare sign-in.');
  document.querySelector('#csrf-token').value=csrfToken;
  if(!logout){
    const next=new URL(params.get('returnTo')||'/',location.origin);
    document.querySelector('#callback-url').value=next.origin===location.origin?next.href:location.origin+'/';
  }
  button.disabled=false;
  status.textContent=params.has('error')?'That password did not match. Please try again.':logout?'':'You’ll stay signed in for 24 hours.';
}catch(e){status.textContent=e.message;status.className='error';}
