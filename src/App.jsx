import { useState } from 'react'
import bslogo from './assets/logo.svg'
import './App.css'

function App() {

  return (
    <>
        <div id="logo">
            <img src={bslogo} alt="BS"  />
        </div>
        <div id ="title">
            <h1>blakesite</h1>
        </div>
    </>
  )
}

export default App
