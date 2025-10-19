// App.jsx
import './App.css'
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Contact from "./pages/Contact";
import NoPage from "./pages/NoPage";
import Navbar from "./components/Navbar.jsx";
import Projects from "./pages/Projects.jsx";
import Project1 from "./projects/Project_2048.jsx";
import Project2 from "./projects/Chess.jsx";
import RequireAuth from './components/RequireAuth.jsx';
import Login from './pages/Login.jsx';
import {Authenticator} from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';

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
                            <Route path="/Projects" element={
                                <RequireAuth>
                                    <Projects/>
                                </RequireAuth>
                            }/>
                            <Route path="/projects/Project_2048" element={<Project1/>} />
                            <Route path="/projects/Chess" element={
                                <RequireAuth>
                                    <Project2/>
                                </RequireAuth>
                            }/>
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
