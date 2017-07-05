var express = require('express');
var app = express();
var counter = 0;
var BALL_SPEED = 10;
var WIDTH = 1100;
var HEIGHT = 580;
var TANK_INIT_HP = 100;

//Static resources server
app.use(express.static(__dirname + '/www'));

var server = app.listen(process.env.PORT || 8082, function () {
	var port = server.address().port;
	console.log('Server running at port %s', port);
});

var io = require('socket.io')(server);

function GameServer(){
	this.players = [];
	this.Bullets = [];
	this.lastbulletid = 0;
}

GameServer.prototype = {

	addpPlayer: function(player){
		this.player.push(player);
	},

	addbullet: function(bullet){
		this.bullets.push(bullet);
	},

	removePlayer: function(playerId){
		//Remove player object
		this.players = this.players.filter( function(t){return t.id != playerId} );
	},

	//Sync player with new data received from a client
	syncPlayer: function(newPlayerData){
		this.players.forEach( function(player){
			if(player.id == newPlayerData.id){
				player.x = newPlayerData.x;
				player.y = newPlayerData.y;
				player.baseAngle = newPlayerData.baseAngle;
				player.cannonAngle = newPlayerData.cannonAngle;
			}
		});
	},

	//The app has absolute control of the bullets and their movement
	syncBullets: function(){
		var self = this;
		//Detect when bullet is out of bounds
		this.bullets.forEach( function(bullet){
			self.detectCollision(bullet);

			if(bullet.x < 0 || bullet.x > WIDTH
				|| bullet.y < 0 || bullet.y > HEIGHT){
				bullet.out = true;
			}else{
				bullet.fly();
			}
		});
	},

	//Detect if bullet collides with any player
	detectCollision: function(bullet){
		var self = this;

		this.players.forEach( function(player){
			if(player.id != bullet.ownerId
				&& Math.abs(player.x - bullet.x) < 30
				&& Math.abs(player.y - bullet.y) < 30){
				//Hit player
				self.hurtPlayer(player);
				bullet.out = true;
				bullet.exploding = true;
			}
		});
	},

	hurtPlayer: function(player){
		player.hp -= 2;
	},

	getData: function(){
		var gameData = {};
		gameData.players = this.players;
		gameData.bullets = this.bullets;

		return gameData;
	},

	cleanDeadPlayers: function(){
		this.players = this.players.filter(function(t){
			return t.hp > 0;
		});
	},

	cleanDeadBullets: function(){
		this.bullets = this.bullets.filter(function(bullet){
			return !bullet.out;
		});
	},

	increaseLastBulletId: function(){
		this.lastBulletId ++;
		if(this.lastBulletId > 1000){
			this.lastBulletId = 0;
		}
	}

}

var game = new GameServer();

/* Connection events */

io.on('connection', function(client) {
	console.log('User connected');

	client.on('joinGame', function(player){
		console.log(player.id + ' joined the game');
		var initX = getRandomInt(40, 900);
		var initY = getRandomInt(40, 500);
		client.emit('addPlayer', { id: player.id, type: player.type, isLocal: true, x: initX, y: initY, hp: TANK_INIT_HP });
		client.broadcast.emit('addPlayer', { id: player.id, type: player.type, isLocal: false, x: initX, y: initY, hp: TANK_INIT_HP} );

		game.addPlayer({ id: player.id, type: player.type, hp: TANK_INIT_HP});
	});

	client.on('sync', function(data){
		//Receive data from clients
		if(data.player != undefined){
			game.syncPlayer(data.player);
		}
		//update bullet positions
		game.syncBullets();
		//Broadcast data to clients
		client.emit('sync', game.getData());
		client.broadcast.emit('sync', game.getData());

		//I do the cleanup after sending data, so the clients know
		//when the player dies and when the bullets explode
		game.cleanDeadPlayers();
		game.cleanDeadBullets();
		counter ++;
	});

	client.on('shoot', function(bullet){
		var bullet = new Bullet(bullet.ownerId, bullet.alpha, bullet.x, bullet.y );
		game.addBullet(bullet);
	});

	client.on('leaveGame', function(playerId){
		console.log(playerId + ' has left the game');
		game.removePlayer(playerId);
		client.broadcast.emit('removePlayer', playerId);
	});

});

function Bullet(ownerId, alpha, x, y){
	this.id = game.lastBulletId;
	game.increaseLastBulletId();
	this.ownerId = ownerId;
	this.alpha = alpha; //angle of shot in radians
	this.x = x;
	this.y = y;
	this.out = false;
};

Bullet.prototype = {

	fly: function(){
		//move to trayectory
		var speedX = BALL_SPEED * Math.sin(this.alpha);
		var speedY = -BALL_SPEED * Math.cos(this.alpha);
		this.x += speedX;
		this.y += speedY;
	}

}

function getRandomInt(min, max) {
	return Math.floor(Math.random() * (max - min)) + min;
}
