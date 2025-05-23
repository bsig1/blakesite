import bslogo from './assets/logo.svg'
import './App.css'
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Contact from "./pages/Contact";
import NoPage from "./pages/NoPage";
import Navbar from "./components/Navbar.jsx";
import Projects from "./pages/Projects.jsx";
import Project1 from "./projects/Project_2048.jsx";


function App() {
  return (
    <>
        <BrowserRouter>
            <Navbar/>
            <div id='page'>
                <Routes>
                    <Route path="/"  element={<Home/>} />
                    <Route path="/Contact"  element={<Contact />}/>
                    <Route path="/Projects"  element={<Projects/>}/>
                    <Route path="/projects/Project_2048" element={<Project1/>} />
                    <Route path="/*" element={<NoPage/>}/>
                </Routes>
            </div>
        </BrowserRouter>
    </>
  )
}

export default App
