// App.jsx
import './App.css'
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Contact from "./pages/Contact";
import NoPage from "./pages/NoPage";
import Navbar from "./components/Navbar.jsx";
import Projects from "./pages/Projects.jsx";
import Project1 from "./projects/2048/2048.jsx";
import Project2 from "./projects/chess/Chess.jsx";
import Project3 from "./projects/two_body/two_body.jsx";
import Login from './pages/Login.jsx';
import {Authenticator} from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { Amplify } from "aws-amplify";
import outputs from "../amplify_outputs.json";

Amplify.configure(outputs);

function App() {
    return (
        <>
            <Authenticator.Provider>
                <BrowserRouter>
                    <Navbar/>
                    <div id='page'>
                        <Routes>
                            <Route path="/" element={<Home/>} />
                            <Route path="/Contact" element={<Contact />}/>
                            <Route path="/Projects" element={<Projects/>}/>
                            <Route path="/projects/Project_2048" element={<Project1/>} />
                            <Route path="/projects/Chess" element={<Project2/>}/>
                            <Route path="/projects/two_body" element={<Project3/>}/>
                            <Route path="/login" element={<Login/>} />
                            <Route path="/*" element={<NoPage/>}/>
                        </Routes>
                    </div>
                </BrowserRouter>
            </Authenticator.Provider>
        </>
    )
}

export default App
