import "./Project_2048.css"
import Canvas from "./Canvas2048.jsx";



const Project_2048 = () => {
    return (
        <>
            <h1 className="page-title">2048</h1>
            <Canvas id="gameBoard" width={400} height={400}/>

        </>
    )

};

export default Project_2048;