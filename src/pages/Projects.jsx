import "./Projects.css"
import logo from"../assets/2048_logo.svg.png"
import {BrowserRouter, Link, Route, Routes} from "react-router-dom";

const Projects = () => {
    return (
        <>
        <h1 className="page-title">Projects</h1>
        <Link to="/projects/Project_2048">
            <div className="project-tile">
                <img src={logo} alt="2048"/>
            </div>
        </Link>

        </>
    )

};

export default Projects;