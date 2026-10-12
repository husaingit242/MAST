import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import Button from '@/components/common/Button';
import Logo from '@/components/common/Logo';
import { mockMode } from '@/services/dataProvider';
import { toApiError } from '@/services/api';
import { authService } from '@/services/authService';
import { useAuthStore } from '@/store/useAuthStore';

export default function Login() {
  const [registering, setRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const user = useAuthStore(state => state.user);
  const authenticate = useAuthStore(state => state.authenticate);
  const navigate = useNavigate();
  if (mockMode) return <Navigate to="/" replace/>;
  if (user) return <Navigate to="/" replace/>;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(null);
    try {
      await authenticate(registering
        ? authService.register({ email, username, full_name: fullName, password })
        : authService.login(username, password));
      navigate('/', { replace: true });
    } catch (reason) { setError(toApiError(reason).message); }
    finally { setBusy(false); }
  }

  return <main className="auth-page"><section className="panel auth-panel"><Logo/><p className="eyebrow">SECURE API WORKSPACE</p><h1>{registering ? 'Create analyst account' : 'Sign in to MAST'}</h1><p>{registering ? 'Registration creates a standard analyst account.' : 'Sign in with your MAST API account to continue.'}</p>
    <form onSubmit={submit}>
      {registering && <><label>Full name<input value={fullName} onChange={event => setFullName(event.target.value)} autoComplete="name" required maxLength={120}/></label><label>Email<input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" required/></label></>}
      <label>{registering ? 'Username' : 'Username or email'}<input value={username} onChange={event => setUsername(event.target.value)} autoComplete="username" required minLength={registering ? 3 : 1}/></label>
      <label>Password<input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete={registering ? 'new-password' : 'current-password'} required minLength={registering ? 12 : 1}/></label>
      {registering && <small>Use at least 12 characters with uppercase, lowercase, and a number.</small>}
      {error && <p role="alert" className="upload-error">{error}</p>}
      <Button type="submit" variant="primary" disabled={busy}>{busy ? 'Please wait…' : registering ? 'Create account' : 'Sign in'}</Button>
    </form>
    <button className="text-link text-button" type="button" onClick={() => { setRegistering(value => !value); setError(null); }}>{registering ? 'Already registered? Sign in' : 'Create an analyst account'}</button>
  </section></main>;
}
