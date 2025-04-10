import {useEffect, useRef} from "react";


function getRandomInt(max) {
    return Math.floor(Math.random() * max);
}


class Tile {
    constructor(value, x, y){
        this._value = value;
        this._x = x;
        this._y = y;
    }
    get x (){
        return this._x;
    }
    get y (){
        return this._y;
    }
    get value(){
        return this._value;
    }


}


class Board {
    constructor(){
        this.state = [];
        for (let y = 0; y < 4; y++) {
            let row = [];
            for (let x = 0; x < 4; x++) {
                row.push(new Tile(-1,x,y));
            }
            this.state.push(row);
        }
        this.generate_tile();
        this.generate_tile();
    }
    set_square(x,y,tile){
        this.state[y][x] = tile;
    }
    get_square(x,y){
        return this.state[y][x];
    }
    generate_tile(){
        let value = 2;
        if(getRandomInt(10)===9){
            value = 4;
        }
        let empty_squares = [];
        for (let y = 0; y < 4; y++) {
            for (let x = 0; x < 4; x++) {
                let square = this.get_square(x,y);
                if(square.value===-1) {
                    empty_squares.push(square);
                }
            }
        }
        let location = empty_squares[getRandomInt(empty_squares.length)];

        this.set_square(location.x,location.y,new Tile(value,location.x,location.y));
    }

    make_move(direction){ //direction is an array of size 2, (x,y) where one value is + or - 1
        if(direction[0]!==0 && direction[1]!==0){
            return false;
        }
        let dx = Math.sign(direction[0]);
        let dy = Math.sign(direction[1]);




    }
}


const Canvas = props => {

    const canvasRef = useRef(null);
    let board = new Board();

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');



        // Draw board lines
        for (let i = 0; i < 4; i++) {
            ctx.beginPath();
            ctx.moveTo(0, 100*i);
            ctx.lineTo(400, 100*i);
            ctx.stroke();
            ctx.closePath();
        }

        for (let i = 0; i < 4; i++) {
            ctx.beginPath();
            ctx.moveTo(100*i,0);
            ctx.lineTo(100*i,400);
            ctx.stroke();
            ctx.closePath();
        }



        ctx.font = "48px Comic Sans MS";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        for (let x = 0; x < 4; x++) {
            for (let y = 0; y < 4; y++) {
                let square = board.get_square(x,y);
                if(square && square.value!==-1){
                    ctx.fillText(String(square.value),x*100+50,y*100+50);
                }
            }
        }
    })

    return <canvas ref={canvasRef} {...props}/>;

}

export default Canvas;