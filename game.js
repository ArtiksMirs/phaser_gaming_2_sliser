var Snake = function(game, spriteKey, x, y,foodGroup , foodCollisionGroup,snakeHeadCollisionGroup) {
    this.game = game;
    this.foodGroup = foodGroup;
    this.foodCollisionGroup = foodCollisionGroup;
    this.snakeHeadCollisionGroup = snakeHeadCollisionGroup;
    //create an array of snakes in the game object and add this snake
    if (!this.game.snakes) {
        this.game.snakes = [];
    }
    this.game.snakes.push(this);
    console.log(this.game.snakes);
    this.debug = false;
    this.snakeLength = 0;
    this.spriteKey = spriteKey;

    //various quantities that can be changed
    this.scale = 0.6;
    this.fastSpeed = 400;
    this.slowSpeed = 130;
    this.speed = this.slowSpeed;
    this.rotationSpeed = 40;
    //initialize groups and arrays
    this.collisionGroup = this.game.physics.p2.createCollisionGroup();
    this.sections = [];
    //the head path is an array of points that the head of the snake has
    //traveled through
    this.headPath = [];
    this.food = [];

    this.preferredDistance = 17 * this.scale;
    this.queuedSections = 0;
    this.queuedRemoveSections = 0;
    this.price = 2;

    //initialize the shadow
    this.shadow = new Shadow(this.game, this.sections, this.scale);
    this.sectionGroup = this.game.add.group();
    //add the head of the snake
    this.head = this.addSectionAtPosition(x,y);
    this.head.name = "head";
    this.head.snake = this;

    this.lastHeadPosition = new Phaser.Point(this.head.body.x, this.head.body.y);
    //add 30 sections behind the head
    this.initSections(10);
    this.kQR = 0;

    //initialize the eyes
    this.eyes = new EyePair(this.game, this.head, this.scale);

    //the edge is the front body that can collide with other snakes
    //it is locked to the head of this snake
    this.edgeOffset = 4;
    this.edge = this.game.add.sprite(x, y - this.edgeOffset, this.spriteKey);
    this.edge.name = "edge";
    this.edge.alpha = 0;
    this.game.physics.p2.enable(this.edge, this.debug);
    this.edge.body.setCircle(this.edgeOffset);
    //constrain edge to the front of the head
    this.edgeLock = this.game.physics.p2.createLockConstraint(
        this.edge.body, this.head.body, [0, -this.head.width*0.5-this.edgeOffset]
    );

    this.edge.body.onBeginContact.add(this.edgeContact, this);

    this.onDestroyedCallbacks = [];
    this.onDestroyedContexts = [];
}

Snake.prototype = {
    /**
     * Give the snake starting segments
     * @param  {Number} num number of snake sections to create
     */
    initFood: function(x, y) {
        var f = new Food(this.game, x, y);
        f.sprite.body.setCollisionGroup(this.foodCollisionGroup);

        this.foodGroup.add(f.sprite);
        f.sprite.body.collides([this.snakeHeadCollisionGroup]);

        return f;
    },
    initSections: function(num) {
        //create a certain number of sections behind the head
        //only use this once
        for (var i = 1 ; i <= num ; i++) {
            var x = this.head.body.x;
            var y = this.head.body.y + i * this.preferredDistance;
            this.addSectionAtPosition(x, y);
            //add a point to the head path so that the section stays there
            this.headPath.push(new Phaser.Point(x,y));
        }

    },
    /**
     * Add a section to the snake at a given position
     * @param  {Number} x coordinate
     * @param  {Number} y coordinate
     * @return {Phaser.Sprite}   new section
     */
    destroySectionAtPosition: function (x , y){

        // this.game.sprite(x , y , this.spriteKey).destroy(true);

        this.lastSpriteCircle.destroy(true)

        this.snakeLength--;
        // this.sectionGroup.remove(this.sectionGroup.children[this.sectionGroup.length - 1] , true)

        this.sections[this.sections.length - 1].destroy();
        this.sections.pop();
        // this.shadow.destroy()
        this.shadow.delete_shadow()
        console.log("DESTROYED")
    },
    addSectionAtPosition: function(x, y) {
        //initialize a new section
        var sec = this.game.add.sprite(x, y, this.spriteKey);

        this.game.physics.p2.enable(sec, this.debug);
        sec.body.setCollisionGroup(this.collisionGroup);
        sec.body.collides([]);
        sec.body.kinematic = true;

        this.snakeLength++;

        this.sectionGroup.add(sec);

        sec.sendToBack();
        sec.scale.setTo(this.scale);

        this.sections.push(sec);

        this.shadow.add(x,y);
        //add a circle body to this section
        sec.body.clearShapes();
        sec.body.addCircle(sec.width*0.5);
        this.lastSpriteCircle = sec;
        return sec;
    },
    /**
     * Add to the queue of new sections
     * @param  {Integer} amount Number of sections to add to queue
     */
    addSectionsAfterLast: function(amount) {
        this.queuedSections += amount;
    },
    /**
     * Call from the main update loop
     */
    update: function() {
        var speed = this.speed;
        this.head.body.moveForward(speed);

        //remove the last element of an array that contains points which
        //the head traveled through
        //then move this point to the front of the array and change its value
        //to be where the head is located
        var point = this.headPath.pop();
        point.setTo(this.head.body.x, this.head.body.y);
        this.headPath.unshift(point);

        //place each section of the snake on the path of the snake head,
        //a certain distance from the section before it
        var index = 0;
        var lastIndex = null;
        for (var i = 0 ; i < this.snakeLength ; i++) {

            this.sections[i].body.x = this.headPath[index].x;
            this.sections[i].body.y = this.headPath[index].y;

            //hide sections if they are at the same position
            if (lastIndex && index == lastIndex) {
                this.sections[i].alpha = 0;
            }
            else {
                this.sections[i].alpha = 1;
            }

            lastIndex = index;
            //this finds the index in the head path array that the next point
            //should be at
            index = this.findNextPointIndex(index);
        }

        //continuously adjust the size of the head path array so that we
        //keep only an array of points that we need
        if (index >= this.headPath.length - 1) {
            var lastPos = this.headPath[this.headPath.length - 1];
            this.headPath.push(new Phaser.Point(lastPos.x, lastPos.y));
        }
        else {
            this.headPath.pop();
        }

        //this calls onCycleComplete every time a cycle is completed
        //a cycle is the time it takes the second section of a snake to reach
        //where the head of the snake was at the end of the last cycle
        var i = 0;
        var found = false;
        while (this.headPath[i].x != this.sections[1].body.x &&
        this.headPath[i].y != this.sections[1].body.y) {
            if (this.headPath[i].x == this.lastHeadPosition.x &&
                this.headPath[i].y == this.lastHeadPosition.y) {
                found = true;
                break;
            }
            i++;
        }
        const lastik_pos = this.headPath[0]
        if ((Math.abs(lastik_pos.x) > this.game.width - 20) || (Math.abs(lastik_pos.y) > this.game.height - 20)){
            this.destroy()
        }
        if (this.speed === this.fastSpeed){
            if ( this.snakeLength>=3){
                this.queuedRemoveSections+=this.price * 0.01;
                this.kQR++;
                if (this.kQR % 10===0){
                    this.initFood(this.headPath[this.headPath.length - 1].x , this.headPath[this.headPath.length - 1].y + 10)
                    // this.queuedSections-=this.price * 0.1;
                }
                console.log(this.food)
                console.log(this.queuedRemoveSections)
            }
            else{
                this.isLightingUp = false;
                this.speed = this.slowSpeed;
            }

        }
        if (this.queuedRemoveSections>=1){
            var lastSec = this.sections[this.sections.length - 1];

            this.destroySectionAtPosition(lastSec.body.x, lastSec.body.y);
            this.queuedRemoveSections = 0;
            this.kQR = 0;
        }
        if (!found) {
            this.lastHeadPosition = new Phaser.Point(this.head.body.x, this.head.body.y);
            this.onCycleComplete();
        }

        //update the eyes and the shadow below the snake
        this.eyes.update();
        this.shadow.update();
    },
    /**
     * Find in the headPath array which point the next section of the snake
     * should be placed at, based on the distance between points
     * @param  {Integer} currentIndex Index of the previous snake section
     * @return {Integer}              new index
     */
    findNextPointIndex: function(currentIndex) {
        var pt = this.headPath[currentIndex];
        //we are trying to find a point at approximately this distance away
        //from the point before it, where the distance is the total length of
        //all the lines connecting the two points
        var prefDist = this.preferredDistance;
        var len = 0;
        var dif = len - prefDist;
        var i = currentIndex;
        var prevDif = null;
        //this loop sums the distances between points on the path of the head
        //starting from the given index of the function and continues until
        //this sum nears the preferred distance between two snake sections
        while (i+1 < this.headPath.length && (dif === null || dif < 0)) {
            //get distance between next two points
            var dist = Util.distanceFormula(
                this.headPath[i].x, this.headPath[i].y,
                this.headPath[i+1].x, this.headPath[i+1].y
            );
            len += dist;
            prevDif = dif;
            //we are trying to get the difference between the current sum and
            //the preferred distance close to zero
            dif = len - prefDist;
            i++;
        }

        //choose the index that makes the difference closer to zero
        //once the loop is complete
        if (prevDif === null || Math.abs(prevDif) > Math.abs(dif)) {
            return i;
        }
        else {
            return i-1;
        }
    },
    /**
     * Called each time the snake's second section reaches where the
     * first section was at the last call (completed a single cycle)
     */
    onCycleComplete: function() {
        if (this.queuedSections >=1) {
            var lastSec = this.sections[this.sections.length - 1];
            this.addSectionAtPosition(lastSec.body.x, lastSec.body.y);
            this.queuedSections = 0;
        }
    },
    /**
     * Set snake scale
     * @param  {Number} scale Scale
     */
    setScale: function(scale) {
        this.scale = scale;
        this.preferredDistance = 17 * this.scale;

        //update edge lock location with p2 physics
        this.edgeLock.localOffsetB = [
            0, this.game.physics.p2.pxmi(this.head.width*0.5+this.edgeOffset)
        ];

        //scale sections and their bodies
        for (var i = 0 ; i < this.sections.length ; i++) {
            var sec = this.sections[i];
            sec.scale.setTo(this.scale);
            sec.body.data.shapes[0].radius = this.game.physics.p2.pxm(sec.width*0.5);
        }

        //scale eyes and shadows
        this.eyes.setScale(scale);
        this.shadow.setScale(scale);
    },
    /**
     * Increment length and scale
     */
    decrimentSize: function (){
        this.queuedRemoveSections+=0.2;
        console.log(this.queuedRemoveSections)
    },
    incrementSize: function() {
        this.addSectionsAfterLast(this.price * 0.1);

        // this.setScale(this.scale * 1.01);
    },
    /**
     * Destroy the snake
     */
    destroy: function() {
        console.log("DESTROY")
        this.game.snakes.splice(this.game.snakes.indexOf(this), 1);
        //remove constraints
        this.game.physics.p2.removeConstraint(this.edgeLock);
        this.edge.destroy();
        //destroy food that is constrained to the snake head
        for (var i = this.food.length - 1 ; i >= 0 ; i--) {
            this.food[i].destroy();
        }
        //destroy everything else
        this.sections.forEach(function(sec, index) {
            sec.destroy();
        });

        this.eyes.destroy();
        this.shadow.destroy();
        console.log("YES")
        //call this snake's destruction callbacks
        for (var i = 0 ; i < this.onDestroyedCallbacks.length ; i++) {
            if (typeof this.onDestroyedCallbacks[i] == "function") {
                this.onDestroyedCallbacks[i].apply(
                    this.onDestroyedContexts[i], [this]);
            }
        }
    },
    /**
     * Called when the front of the snake (the edge) hits something
     * @param  {Phaser.Physics.P2.Body} phaserBody body it hit
     */
    edgeContact: function(phaserBody) {
        //if the edge hits another snake's section, destroy this snake
        if (phaserBody && this.sections.indexOf(phaserBody.sprite) == -1) {
            console.log("Contact")
            this.destroy();
        }
            //if the edge hits this snake's own section, a simple solution to avoid
            //glitches is to move the edge to the center of the head, where it
        //will then move back to the front because of the lock constraint
        else if (phaserBody) {
            this.edge.body.x = this.head.body.x;
            this.edge.body.y = this.head.body.y;
        }
    },
    /**
     * Add callback for when snake is destroyed
     * @param  {Function} callback Callback function
     * @param  {Object}   context  context of callback
     */
    addDestroyedCallback: function(callback, context) {
        this.onDestroyedCallbacks.push(callback);
        this.onDestroyedContexts.push(context);
    }
};
PlayerSnake = function(game, spriteKey, x, y , foodGroup , foodCollisionGroup,snakeHeadCollisionGroup) {
    Snake.call(this, game, spriteKey, x, y,foodGroup , foodCollisionGroup,snakeHeadCollisionGroup);
    this.cursors = game.input.keyboard.createCursorKeys();
    this.game.canvas.onmousedown =this.spaceKeyDown.bind(this);
    this.game.canvas.onmouseup = this.spaceKeyUp.bind(this);
    //handle the space key so that the player's snake can speed up
    var spaceKey = this.game.input.keyboard.addKey(Phaser.Keyboard.SPACEBAR);
    var self = this;
    spaceKey.onDown.add(this.spaceKeyDown, this);
    spaceKey.onUp.add(this.spaceKeyUp, this);
    this.addDestroyedCallback(function() {
        spaceKey.onDown.remove(this.spaceKeyDown, this);
        spaceKey.onUp.remove(this.spaceKeyUp, this);
    }, this);
}

PlayerSnake.prototype = Object.create(Snake.prototype);
PlayerSnake.prototype.constructor = PlayerSnake;

//make this snake light up and speed up when the space key is down
PlayerSnake.prototype.spaceKeyDown = function(e) {
    this.shadow.isLightingUp = true;
    if (this.snakeLength>=3){
        this.speed = this.fastSpeed;

    }

}
//make the snake slow down when the space key is up again
PlayerSnake.prototype.spaceKeyUp = function(e) {
    this.speed = this.slowSpeed;
    this.shadow.isLightingUp = false;
}

/**
 * Add functionality to the original snake update method so that the player
 * can control where this snake goes
 */
PlayerSnake.prototype.tempUpdate = PlayerSnake.prototype.update;
PlayerSnake.prototype.update = function() {
    //find the angle that the head needs to rotate
    //through in order to face the mouse
    console.log(this.game.input.Point)
    var mousePosX = this.game.input.activePointer.worldX;
    console.log("update")
    var mousePosY = this.game.input.activePointer.worldY;
    var headX = this.head.body.x;
    console.log(mousePosX , mousePosY)
    var headY = this.head.body.y;
    var angle = (180*Math.atan2(mousePosX-headX,mousePosY-headY)/Math.PI);
    if (angle > 0) {
        angle = 180-angle;
    }
    else {
        angle = -180-angle;
    }
    var dif = this.head.body.angle - angle;
    // this.head.body.setZeroRotation();
    //allow arrow keys to be used
    // if (this.cursors.left.isDown) {
    //     console.log("21")
    //     this.head.body.rotateLeft(this.rotationSpeed);
    // }
    // else if (this.cursors.right.isDown) {
    //     console.log("1")
    //     this.head.body.rotateRight(this.rotationSpeed);
    // }
    //decide whether rotating left or right will angle the head towards
    //the mouse faster, if arrow keys are not used
    if (dif < 0 && dif > -180 || dif > 180) {
        console.log("right")
        this.head.body.rotateRight(this.rotationSpeed);
    }
    else if (dif > 0 && dif < 180 || dif < -180) {
        console.log("left")
        this.head.body.rotateLeft(this.rotationSpeed);
    }
    else{
        console.log("STOOOP")
        this.head.body.rotateLeft(this.rotationSpeed)
    }
    if (mousePosX === undefined){
        console.log("STOP")
    }


    //call the original snake update method
    this.tempUpdate();
}
Food = function(game, x, y) {
    this.game = game;
    this.debug = false;
    this.sprite = this.game.add.sprite(x, y, 'food');
    this.sprite.tint = 0xff0000;

    this.game.physics.p2.enable(this.sprite, this.debug);
    this.sprite.body.clearShapes();
    this.sprite.body.addCircle(this.sprite.width * 0.5);
    //set callback for when something hits the food
    this.sprite.body.onBeginContact.add(this.onBeginContact, this);

    this.sprite.food = this;
    console.log(this.sprite.food , "Sprite")

    this.head = null;
    this.constraint = null;
}

Food.prototype = {
    onBeginContact: function(phaserBody, p2Body) {
        if (phaserBody && phaserBody.sprite.name == "head" && this.constraint === null) {
            this.sprite.body.collides([]);
            //Create constraint between the food and the snake head that
            //it collided with. The food is then brought to the center of
            //the head sprite
            this.constraint = this.game.physics.p2.createRevoluteConstraint(
                this.sprite.body, [0,0], phaserBody, [0,0]
            );
            this.head = phaserBody.sprite;
            this.head.snake.food.push(this);
        }
    },
    /**
     * Call from main update loop
     */
    update: function() {
        //once the food reaches the center of the snake head, destroy it and
        //increment the size of the snake
        if (this.head && Math.round(this.head.body.x) == Math.round(this.sprite.body.x) &&
            Math.round(this.head.body.y) == Math.round(this.sprite.body.y)) {
            this.head.snake.incrementSize();

            this.destroy();
        }
    },
    /**
     * Destroy this food and its constraints
     */
    destroy: function() {
        if (this.head) {
            this.game.physics.p2.removeConstraint(this.constraint);
            this.sprite.destroy();

            this.head.snake.food.splice(this.head.snake.food.indexOf(this), 1);
            this.head = null;
        }
    }
};
/**
 * Creates a pair of eyes
 * @param  {Phaser.Game} game  game object
 * @param  {Phaser.Sprite} head  Snake head sprite
 * @param  {Number} scale scale of eyes
 */
EyePair = function(game, head, scale) {
    this.game = game;
    this.head = head;
    this.scale = scale;
    this.eyes = [];

    this.debug = false;

    //create two eyes
    var offset = this.getOffset();
    this.leftEye = new Eye(this.game, this.head, this.scale);
    this.leftEye.updateConstraints([-offset.x, -offset.y]);
    this.eyes.push(this.leftEye);

    this.rightEye = new Eye(this.game, this.head, this.scale);
    this.rightEye.updateConstraints([offset.x, -offset.y]);
    this.eyes.push(this.rightEye);
}

EyePair.prototype = {
    /**
     * Get the offset that eyes should be from the head (based on scale)
     * @return {Object} offset distance with properties x and y
     */
    getOffset: function() {
        var xDim = this.head.width*0.25;
        var yDim = this.head.width*.125;
        return {x: xDim, y: yDim};
    },
    /**
     * Set the scale of the eyes
     * @param  {Number} scale new scale
     */
    setScale: function(scale) {
        this.leftEye.setScale(scale);
        this.rightEye.setScale(scale);
        //update constraints to place them at the right offset
        var offset = this.getOffset();
        this.leftEye.updateConstraints([-offset.x, -offset.y]);
        this.rightEye.updateConstraints([offset.x, -offset.y]);
    },
    /**
     * Call from snake update loop
     */
    update: function() {
        for (var i = 0 ; i < this.eyes.length ; i++) {
            this.eyes[i].update();
        }
    },
    /**
     * Destroy this eye pair
     */
    destroy: function() {
        this.leftEye.destroy();
        this.rightEye.destroy();
    }
};
/**
 * The black and white parts of a snake eye, with constraints
 * @param  {Phaser.Game} game  game object
 * @param  {Phaser.Sprite} head  snake head sprite
 * @param  {Number} scale scale of the new eye
 */
Eye = function(game, head, scale) {
    this.game = game;
    this.head = head;
    this.scale = scale;
    this.eyeGroup = this.game.add.group();
    this.collisionGroup = this.game.physics.p2.createCollisionGroup();
    this.debug = false;

    //constraints that will hold the circles in place
    //the lock will hold the white circle on the head, and the distance
    //constraint (dist) will keep the black circle within the white one
    this.lock = null;
    this.dist = null;

    //initialize the circle sprites
    this.whiteCircle = this.game.add.sprite(
        this.head.body.x, this.head.body.y, "eye-white"
    );
    this.whiteCircle = this.initCircle(this.whiteCircle);

    this.blackCircle = this.game.add.sprite(
        this.whiteCircle.body.x, this.whiteCircle.body.y, "eye-black"
    );
    this.blackCircle = this.initCircle(this.blackCircle);
    this.blackCircle.body.mass = 0.01;



}

Eye.prototype = {
    /**
     * Initialize a circle, whether it is the black or white one
     * @param  {Phaser.Sprite} circle sprite to initialize
     * @return {Phaser.Sprite}        initialized circle
     */
    initCircle: function(circle) {
        circle.scale.setTo(this.scale);
        this.game.physics.p2.enable(circle, this.debug);
        circle.body.clearShapes();
        //give the circle a circular physics body
        circle.body.addCircle(circle.width*0.5);
        circle.body.setCollisionGroup(this.collisionGroup);
        circle.body.collides([]);
        this.eyeGroup.add(circle);
        return circle;
    },
    /**
     * Ensure that the circles of the eye are constrained to the head
     * @param  {Array} offset Array in the form [x,y] of offset from the snake head
     */
    updateConstraints: function(offset) {
        //change where the lock constraint of the white circle
        //is if it already exists
        if (this.lock) {
            this.lock.localOffsetB = [
                this.game.physics.p2.pxmi(offset[0]),
                this.game.physics.p2.pxmi(Math.abs(offset[1]))
            ];
        }
        //create a lock constraint if it doesn't already exist
        else {
            this.lock = this.game.physics.p2.createLockConstraint(
                this.whiteCircle.body, this.head.body, offset, 0
            );
        }

        //change the distance of the distance constraint for
        //the black circle if it exists already
        if (this.dist) {
            this.dist.distance = this.game.physics.p2.pxm(this.whiteCircle.width*0.25);
        }
        //create a distance constraint if it doesn't exist already
        else {
            this.dist = this.game.physics.p2.createDistanceConstraint(
                this.blackCircle.body, this.whiteCircle.body, this.whiteCircle.width*0.25
            );
        }
    },
    /**
     * Set the eye scale
     * @param  {Number} scale new scale
     */
    setScale: function(scale) {
        this.scale = scale;
        for (var i = 0 ; i < this.eyeGroup.children.length ; i++) {
            var circle = this.eyeGroup.children[i];
            circle.scale.setTo(this.scale);
            //change the radii of the circle bodies using pure p2 physics
            circle.body.data.shapes[0].radius = this.game.physics.p2.pxm(circle.width*0.5);
        }

    },
    /**
     * Call from the update loop
     */
    update: function() {
        var mousePosX = this.game.input.activePointer.worldX;
        var mousePosY = this.game.input.activePointer.worldY;
        try{
            var headX = this.head.body.x;
            var headY = this.head.body.y;
            var angle = Math.atan2(mousePosY-headY, mousePosX-headX);
            var force = 300;
            //move the black circle of the eye towards the mouse
            this.blackCircle.body.moveRight(force*Math.cos(angle));
            this.blackCircle.body.moveDown(force*Math.sin(angle));
        }
        catch (er){
            console.log(er)
        }

    },
    /**
     * Destroy this eye
     */
    destroy: function() {
        this.whiteCircle.destroy();
        this.blackCircle.destroy();
        this.game.physics.p2.removeConstraint(this.lock);
        this.game.physics.p2.removeConstraint(this.dist);
    }
};

Shadow = function(game, sections, scale) {
    this.game = game;
    this.sections = sections;
    this.scale = scale;
    this.shadowGroup = this.game.add.group();
    this.shadows = [];
    this.isLightingUp = false;

    this.lightStep = 0;
    this.maxLightStep = 3;

    this.lightUpdateCount = 0;
    this.updateLights = 3;

    //various tints that the shadow could have
    //since the image is white
    this.darkTint = 0xaaaaaa;
    this.lightTintBright = 0xaa3333;
    this.lightTintDim = 0xdd3333;
}

Shadow.prototype = {
    /**
     * Add a new shadow at a position
     * @param  {Number} x coordinate
     * @param  {Number} y coordinate
     */
    add: function(x, y) {
        var shadow = this.game.add.sprite(x, y, "shadow");
        shadow.scale.setTo(this.scale);
        shadow.anchor.set(0.5);
        this.shadowGroup.add(shadow);
        this.shadows.push(shadow);
    },
    delete_shadow: function (){
        this.shadowGroup.remove(this.shadowGroup.children[this.shadowGroup.length - 1] , true);
        this.shadows.splice(this.shadows.length - 1 , 1)
    },
    /**
     * Call from the snake update loop
     */
    update: function() {
        try {


            var lastPos = null;
            for (var i = 0; i < this.sections.length; i++) {

                var shadow = this.shadows[i];
                var pos = {
                    x: this.sections[i].body.x,
                    y: this.sections[i].body.y
                };

                //hide the shadow if the previous shadow is in the same position
                if (lastPos && pos.x == lastPos.x && pos.y == lastPos.y) {
                    shadow.alpha = 0;
                    shadow.naturalAlpha = 0;
                } else {
                    shadow.alpha = 1;
                    shadow.naturalAlpha = 1;
                }
                //place each shadow below a snake section
                shadow.position.x = pos.x;
                shadow.position.y = pos.y;

                lastPos = pos;
            }

            //light up shadow with bright tints
            if (this.isLightingUp) {
                this.lightUpdateCount++;
                if (this.lightUpdateCount >= this.updateLights) {
                    this.lightUp();
                }
            }
            //make shadow dark
            else {
                for (var i = 0; i < this.shadows.length; i++) {
                    var shadow = this.shadows[i];
                    shadow.tint = this.darkTint;
                }
            }
        }
        catch (er){
            console.log("ale")
        }

    },
    /**
     * Set scale of the shadow
     * @param  {Number} scale scale of shadow
     */
    setScale: function(scale) {
        this.scale = scale;
        for (var i = 0 ; i < this.shadows.length ; i++) {
            this.shadows[i].scale.setTo(scale);
        }
    },
    /**
     * Light up the shadow from a gray to a bright color
     */
    lightUp: function() {
        this.lightUpdateCount = 0;
        for (var i = 0 ; i < this.shadows.length ; i++) {
            var shadow = this.shadows[i];
            if (shadow.naturalAlpha > 0) {
                //create an alternating effect so shadow is not uniform
                if ((i - this.lightStep) % this.maxLightStep === 0 ) {
                    shadow.tint = this.lightTintBright;
                }
                else {
                    shadow.tint = this.lightTintDim;
                }
            }
        }
        //use a counter to decide how to alternate shadow tints
        this.lightStep++;
        if (this.lightStep == this.maxLightStep) {
            this.lightStep = 0;
        }
    },
    /**
     * destroy the shadow
     */
    destroy: function() {
        for (var i = this.shadows.length - 1 ; i >= 0 ; i--) {
            this.shadows[i].destroy();
        }
    }
};

otherPlayers = function(game, spriteKey, x, y) {
    Snake.call(this, game, spriteKey, x, y);
    this.trend = 1;
}

otherPlayers.prototype = Object.create(Snake.prototype);
otherPlayers.prototype.constructor = otherPlayers;

/**
 * Add functionality to the original snake update method so that this bot snake
 * can turn randomly
 */
otherPlayers.prototype.tempUpdate = otherPlayers.prototype.update;
otherPlayers.prototype.update = function() {
    this.head.body.setZeroRotation();

    //ensure that the bot keeps rotating in one direction for a
    //substantial amount of time before switching directions
    if (Util.randomInt(1,20) == 1) {
        this.trend *= -1;
    }
    this.head.body.rotateRight(this.trend * this.rotationSpeed);
    this.tempUpdate();
}



const Util = {
    /**
     * Generate a random number within a closed range
     * @param  {Integer} min Minimum of range
     * @param  {Integer} max Maximum of range
     * @return {Integer}     random number generated
     */
    randomInt: function(min, max) {
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },
    /**
     * Calculate distance between two points
     * @param  {Number} x1 first point
     * @param  {Number} y1 first point
     * @param  {Number} x2 second point
     * @param  {Number} y2 second point
     */
    distanceFormula: function(x1, y1, x2, y2) {
        var withinRoot = Math.pow(x1-x2,2) + Math.pow(y1-y2,2);
        var dist = Math.pow(withinRoot,0.5);
        return dist;
    }
};

Game = function (game){}
Game.prototype = {
    preload: function() {
        console.log("preload")
        //load assets
        this.game.load.image('circle','asset/circle.png');
    	this.game.load.image('shadow', 'asset/white-shadow.png');
    	this.game.load.image('background', 'asset/tile.png');
        this.game.load.image("border" , "asset/border.png")
    	this.game.load.image('eye-white', 'asset/eye-white.png');
    	this.game.load.image('eye-black', 'asset/eye-black.png');

        this.game.load.image('food', 'asset/hex.png');
    },
    create: async function() {
        var width = this.game.width;
        var height = this.game.height;
        this.socket=  this.game.socket;
        this.game.world.setBounds(-width, -height, width*2, height*2);
    	this.game.stage.backgroundColor = '#444';

        //add tilesprite background
        var background = this.game.add.tileSprite(-width, -height,
            this.game.world.width, this.game.world.height, 'background');
        this.game.add.tileSprite(-width , -height , this.game.world.width , 20 , "border")
        this.game.add.tileSprite(-width , -height , 20 , this.game.world.height , "border")
        this.game.add.tileSprite(width , height , -this.game.world.width , -20 , "border")
        this.game.add.tileSprite(width , height , -20 , -this.game.world.height , "border")
        //initialize physics and groups
        this.game.physics.startSystem(Phaser.Physics.P2JS);
        this.foodGroup = this.game.add.group();
        this.snakeHeadCollisionGroup = this.game.physics.p2.createCollisionGroup();
        this.foodCollisionGroup = this.game.physics.p2.createCollisionGroup();

        //add food randomly
        for (var i = 0 ; i < 12 ; i++) {
            this.initFood(Util.randomInt(-width, width), Util.randomInt(-height, height));
        }

        this.game.snakes = [];
        this.players = this.game.add.group();
        const self = this;
        var snake = new PlayerSnake(this.game, 'circle', 0, 0,this.foodGroup,this.foodCollisionGroup,this.snakeHeadCollisionGroup);
        this.game.camera.follow(snake.head);
        for(let i = 0;i<10;i++){
            new otherPlayers(this.game , "circle" , Util.randomInt(-1000 , 1000) , Util.randomInt(-1000 , 1000) , this.foodGroup ,this.foodCollisionGroup , this.snakeHeadCollisionGroup)
        }


        for (var i = 0 ; i < self.game.snakes.length ; i++) {
            var snake = self.game.snakes[i];
            console.log(snake , "snakeee")
            snake.head.body.setCollisionGroup(self.snakeHeadCollisionGroup);
            snake.head.body.collides([self.foodCollisionGroup]);
            //callback for when a snake is destroyed
            snake.addDestroyedCallback(self.snakeDestroyed, self);
        }

    },
    /**
     * Main update loop
     */

    update: function() {
        //update game components
        console.log("update world")
        for (var i = this.game.snakes.length - 1 ; i >= 0 ; i--) {
            this.game.snakes[i].update();

        }
        for (var i = this.foodGroup.children.length - 1 ; i >= 0 ; i--) {

            var f = this.foodGroup.children[i];
            f.food.update();
        }
    },
    /**
     * Create a piece of food at a point
     * @param  {number} x x-coordinate
     * @param  {number} y y-coordinate
     * @return {Food}   food object created
     */
    initFood: function(x, y) {
        var f = new Food(this.game, x, y);
        f.sprite.body.setCollisionGroup(this.foodCollisionGroup);
        this.foodGroup.add(f.sprite);
        f.sprite.body.collides([this.snakeHeadCollisionGroup]);

        return f;
    },
    snakeDestroyed: function(snake) {
        //place food where snake was destroyed
        for (var i = 0 ; i < snake.headPath.length ;
        i += Math.round(snake.headPath.length / snake.snakeLength) * 2) {
            this.initFood(
                snake.headPath[i].x + Util.randomInt(-10,10),
                snake.headPath[i].y + Util.randomInt(-10,10)
            );
        }
    }
};
