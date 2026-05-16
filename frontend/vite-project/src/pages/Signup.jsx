import React, { useState } from 'react';
import { createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { Link, useNavigate } from 'react-router-dom';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      if (displayName) {
        await updateProfile(cred.user, { displayName });
      }
      
      // Save user to Firestore
      await setDoc(doc(db, 'users', cred.user.uid), {
        name: displayName || email.split('@')[0],
        email: email,
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString()
      });

      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const signupWithGoogle = async () => {
    setError('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      
      // Save user to Firestore
      await setDoc(doc(db, 'users', cred.user.uid), {
        name: cred.user.displayName || cred.user.email.split('@')[0],
        email: cred.user.email,
        createdAt: cred.user.metadata.creationTime || new Date().toISOString(),
        lastLogin: new Date().toISOString()
      }, { merge: true });

      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white p-8 rounded-xl shadow">
        <h2 className="text-2xl font-bold mb-6">Sign up</h2>
        {error && <p className="text-red-600 mb-4">{error}</p>}
        <form onSubmit={handleSignup} className="space-y-4">
          <input
            type="text"
            placeholder="Name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full border rounded-lg p-3"
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border rounded-lg p-3"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border rounded-lg p-3"
            required
          />
          <button disabled={loading} className="w-full bg-pink-600 text-white rounded-lg p-3">
            {loading ? 'Creating...' : 'Create account'}
          </button>
        </form>
        <button onClick={signupWithGoogle} className="w-full mt-3 bg-blue-600 text-white rounded-lg p-3">
          Continue with Google
        </button>
        <p className="mt-4 text-sm">
          Already have an account? <Link to="/login" className="text-pink-600">Login</Link>
        </p>
      </div>
    </div>
  );
}


