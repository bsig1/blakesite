import {useEffect, useState} from 'react'
import bslogo from './assets/logo.svg'
import './App.css'
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./pages/Layout";
import Home from "./pages/Home";
import Contact from "./pages/Contact";
import NoPage from "./pages/NoPage";


const RedirectPage = () => {
    React.useEffect(() => {
        window.location.replace('https://www.google.com')
    }, [])
}
function App() {
  return (
    <>
        <div id="navbar">
            <div id="logo">
                <img src={bslogo} alt="BS"  />
            </div>
            <BrowserRouter id="navigation">
                <Routes>
                    <Route path="/" element={<Layout />}>
                        <Route index element={<Home />} />
                        <Route path="contact" element={<Contact />} />
                        <Route path="*" element={<NoPage />} />
                    </Route>
                </Routes>
            </BrowserRouter>
        </div>
    </>
  )
}

export default App
