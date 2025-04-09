import "./Projects.css"
import Project1 from "../Projects/Project1.jsx"
import {BrowserRouter, Link, Route, Routes} from "react-router-dom";

const Projects = () => {
    return (
        <>
        <h1 id="page-title">Projects</h1>
        <Link to="/projects/Project1">
            <div className="project-tile"></div>
        </Link>

        </>
    )

};

export default Projects;