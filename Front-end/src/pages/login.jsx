import React, {useState, useEffect} from "react";
import { useNavigate } from "react-router";
import { GoogleLogin } from '@react-oauth/google';

function Login() {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({username: '', password: ''});
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        const activeToken = localStorage.getItem('token');
        if(activeToken){
            navigate('/'); 
        }
    }, [navigate])

    // Handle input changes
    const handleChange = (e) => {
        setFormData({...formData, [e.target.name]: e.target.value});
    };

    //Handle form submission
    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage('');
        setError(false);
        try{
            const response = await fetch('http://localhost:3000/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData),
            });

            const data = await response.json();
            //checks if the response is ok
            if(!response.ok){
                setError(true);
                setMessage(data.message || "Invalid username or password"); //Displays the error message: "Invalid username" or "Invalid password"
                return;
            }
            setMessage(data.message); //Displays the success message: "Login successful"
            setFormData({username: '', password: ''}); //Resets the form fields
        }catch(err){
            setError(true);
            setMessage('Failed to connect to the server');
        }
    };

    const handleGoogleSuccess = async (credentialResponse) => {
      try {
        const googleToken = credentialResponse.credential; 

        // Send the token payload across the network to our new backend route
         const response = await fetch('http://localhost:3000/auth/google', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({googleToken})
         });

         const data = await response.json();
         // checks the response
         if (!response.ok) {
            setError(data.message || 'Google Authentication failed. Please try again.');
            return;
         }
      
         const { token, user } = data;
         localStorage.setItem('token', token);
         window.dispatchEvent(new Event('authChange'));
         console.log('Successfully logged in via Google as:', user.username);
         navigate('/');

        } catch (err) {
            setError('Google Authentication failed. Please try again.')
        }
    };

    return (
        <div style={{maxWidth: '400px', margin: 'auto', padding: '20px'}}>
            <h2>Log In</h2>
            <form onSubmit={handleSubmit}>
                <input type="text" name="username" placeholder="Username" required value={formData.username} onChange={handleChange}/>
                <input type="password" name="password" placeholder="Password" required value={formData.password} onChange={handleChange}/>
                <button type="submit">Log In</button>
            </form>

            {message && (
                <p style={{color: error ? 'red' : 'green', marginTop: '10px'}}>
                    {message}
                </p>
            )}

            <div style={{ margin: '1.5rem 0', textAlign: 'center', color: '#666' }}>─ OR ─</div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
                <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => setError('Google Authentication Failed')}
                />
            </div>

        </div>
    );
};
export default Login;