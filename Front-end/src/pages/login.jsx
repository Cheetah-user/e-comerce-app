import React, {useState} from "react";

function Login() {
    const [formData, setFormData] = useState({username: '', password: ''});
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

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

            const data = await response.text();
            //checks if the response is ok
            if(!response.ok){
                setError(true);
                setMessage(data); //Displays the error message: "Invalid email" or "Invalid password"
                return;
            }
            setMessage(data); //Displays the success message: "Login successful"
            setFormData({username: '', password: ''}); //Resets the form fields
        }catch(err){
            setError(true);
            setMessage('Failed to connect to the server');
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
        </div>
    );
};
export default Login;