import "./Projects.css";
import logo_2048 from "../assets/2048_logo.svg.png";
import logo_chess from "../assets/chessicon.jpg";
import logo_two_body from "../assets/two_body.jpeg";
import { Link } from "react-router-dom";

const Projects = () => {
    return (
        <>
            <h1 id="page-title" className="page-title">Projects</h1>

            <div className="projects-grid">
                <Link to="/projects/Project_2048" className="project-tile">
                    <img src={logo_2048} alt="2048" />
                </Link>

                <Link to="/projects/Chess" className="project-tile">
                    <img src={logo_chess} alt="Chess" />
                </Link>
                <Link to="/projects/two_body" className="project-tile">
                    <img src={logo_two_body} alt="Two Body" />
                </Link>
            </div>
        </>
    );
};

export default Projects;