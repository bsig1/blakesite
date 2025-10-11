import "./Projects.css"
import logo_2048 from"../assets/2048_logo.svg.png"
import logo_chess from"../assets/chessicon.jpg"
import {Link} from "react-router-dom";

const Projects = () => {
    return (
        <>
            <h1 className="page-title">Projects</h1>
            <Link to="/projects/Project_2048">
                <div className="project-tile">
                    <img src={logo_2048} alt="2048"/>
                </div>
            </Link>
            <Link to="/projects/chess">
                <div className="project-tile">
                    <img src={logo_chess} alt="chess"/>
                </div>
            </Link>

        </>
    )

};

export default Projects;