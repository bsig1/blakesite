import { useState } from 'react'
import bslogo from './assets/logo.svg'
import './App.css'
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./pages/Layout";
import Home from "./pages/Home";
import Contact from "./pages/Contact";
import NoPage from "./pages/NoPage";
function App() {

  return (
    <>
        <div id="logo">
            <img src={bslogo} alt="BS"  />
        </div>
        <div id ="title">
            <h1>blakesite</h1>
        </div>
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Layout />}>
                    <Route index element={<Home />} />
                    <Route path="contact" element={<Contact />} />
                    <Route path="*" element={<NoPage />} />
                </Route>
            </Routes>
        </BrowserRouter>
    </>
  )
}

export default App
