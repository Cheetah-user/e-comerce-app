import React, {useState} from "react";
import { useNavigate } from "react-router";

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
function Register() {
    const [formData, setFormData] = useState({username: '', email: '', password: ''});
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();
    // Handle input changes
    const handleChange = (e) => {
        setFormData({...formData, [e.target.name]: e.target.value});
    };
    // handle form submissions 
    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage('');
        setError(false);
        try {
            const response = await fetch(`${API_BASE_URL}/register`, {
               method: 'POST',
               headers: {
                'Content-Type': 'application/json'
               },
               body: JSON.stringify(formData),
            });

            //checks if the response is ok
            if (!response.ok){
                const errorText = await response.text();
                setError(true);
                setMessage(errorText); // Displays the error message: "Username already exists" or "Email already exists"
                return;
            }

            const data = await response.json(); 

            localStorage.setItem('token', data.token);
            window.dispatchEvent(new Event('authChange'));
            navigate('/');

        }catch(err){
            setError(true);
            setMessage('Failed to connect to the server');
        }
    };

    return (
        <div style={{maxWidth: '400px', margin: 'auto', padding: '20px'}}>
            <h2> Create an Account</h2>
            <form onSubmit={handleSubmit}>
                <input type="text" name="username" placeholder="Username" required value={formData.username} onChange={handleChange}/>
                <input type="email" name="email" placeholder="Email" required value={formData.email} onChange={handleChange} />
                <input type="password" name="password" placeholder="Password" required value={formData.password} onChange={handleChange}/>
                <button type="submit">Register</button>
            </form>

            {message && (
                <p style={{color: error ? 'red': 'green', marginTop: '10px' }}>
                    {message}
                </p>
            )}
        </div>
    )
}

export default Register;