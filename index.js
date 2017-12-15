var express = require('express')
var app = express()
app.use(express.static('public'))

var BASE = '/events2017/'

var venues = []
var events = []

function Venue (venue_id, name, postcode, town, url, icon) {
	this.venue_id = venue_id;
	this.name = name;
	this.postcode = postcode;
	this.town = town;
	this.url = url;
	this.icon = icon;
}

function Event (event_id, title, blurb, date, url, venue) {
	this.event_id = event_id;
	this.title = title;
	this.blurb = blurb;
	this.date = date;
	this.url = url;
	this.venue = venue;
}

app.get(BASE + 'venues', function(req, resp){
	console.log('GET venues')
	var json = {}
	json.venues = {}
	venues.forEach(function(venue) {
		json.venues[venue.venue_id] = venue;
	})
	resp.setHeader('Content-Type', 'application/json');
	resp.status(200)
	resp.send(json);
})

app.get(BASE + 'events/search', function(req, resp) {
	console.log('GET events/search')
	var search = req.query.search
	var date = req.query.date
	
	var json = []
	events.forEach(function(event) {
		if(!search || event.title.toLowerCase().includes(search.toLowerCase())){
			if(!date){
				json.push(event)
			}
			else{
				var eventDate = new Date(Date.parse(event.date)).setHours(0,0,0,0)
				var queryDate = new Date(Date.parse(date)).setHours(0,0,0,0)
				if(eventDate == queryDate){
					json.push(event)
				}
			}
		}
	})
	resp.setHeader('Content-Type', 'application/json');
	resp.status(200)
	resp.send(json)
})

app.get(BASE + 'events/get/:event_id', function(req, resp) {
	console.log('GET events/get/:id')
	var id = req.params.event_id
	var found = false
	
	events.some(function(event) {
		if(event.event_id == id){
			resp.setHeader('Content-Type', 'application/json');
			resp.status(200)
			resp.send(event)
			found = true
			return true
		}
	})
	
	if(!found){
	var json = {}
		json.error = 'no such event'
		resp.setHeader('Content-Type', 'application/json');
		resp.status(404)
		resp.send(json)
	}
})

app.post(BASE + 'venues/add', function(req, resp) {
	console.log('POST venues/add')
	var auth_token = req.query.auth_token
	var name = req.query.name
	var postcode = req.query.postcode
	var town = req.query.town
	var url = req.query.url
	var icon = req.query.icon
	
	if(auth(auth_token)){
		var last_id = venues[venues.length - 1]
		var id = 'v_' + (parseInt(last_id.substring(2,last_id.length), 10) + 1)
		var venue = new Venue(id, name, postcode, town, url, icon)
		venues.push(venue)
		json.success = 'successful'
		resp.setHeader('Content-Type', 'application/json');
		resp.status(200)
		resp.send(json)
	}
	else{
		var json = {}
		json.error = 'not authorised, wrong token'
		resp.setHeader('Content-Type', 'application/json');
		resp.status(401)
		resp.send(json)
	}
})

app.post(BASE + 'events/add', function(req, resp) {
	console.log('POST events/add')
	var auth_token = req.query.auth_token
	var event_id = req.query.event_id
	var title = req.query.title
	var venue_id = req.query.venue_id
	var date = req.query.date
	var url = req.query.url
	var blurb = req.query.blurb
	
	if(auth(auth_token)){
		var venue
		venues.some(function(v) {
			if(v.venue_id == venue_id){
				venue = v
				return true
			}
		})
		
		if(venue){
			events = events.filter(function(event) { return event.id == event_id })
			var event = new Event(event_id, title, blurb, date, url, venue)
			events.push(event)
			var json = {}
			json.success = 'successful'
			resp.setHeader('Content-Type', 'application/json');
			resp.status(200)
			resp.send(json)
		}
		else{
			var json = {}
			json.error = 'venue not found'
			resp.setHeader('Content-Type', 'application/json');
			resp.status(400)
			resp.send(json)
		}
	}
	else{
		var json = {}
		json.error = 'not authorised, wrong token'
		resp.setHeader('Content-Type', 'application/json');
		resp.status(401)
		resp.send(json)
	}
})


venues.push(new Venue('v_1', 'DSU', 'DH4 6DW', 'Durham', 'www.google.com', 'hi'));
venues.push(new Venue('v_2', 'Home', 'DH1 1EP', 'Bournmoor', 'www.google.com', 'hi'));

events.push(new Event('e_1', 'Fun times at steven\'s house', 'Have some fun times', '2018-05-21T16:00:00Z', 'www.google.com', venues[0]));




auth_tokens = []

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function auth(token, ip){	
	var found = false
	
	events.some(function(auth_token) { 
		if(auth_token.token == token){
			if(auth_token.ip == ip){
				var token_time = auth_token.time
				var time = new Date()
				var dif = time.getDate() - token_time.getDate()
				if(dif < 1000 * 3600 * 2){
					found = true
					return true
				}
			}
		}
	})
	
	events = events.filter(function(auth_token) {
		return auth_token.time.getDate() > new Date().getDate()
	})
	
	return found
}

function generateAuth(ip){
	var token = uuid()
	var time = new Date()
	
	var auth_token = {}
	auth_token.token = token
	auth_token.time = new Date(Date.parse(time))
	auth_token.ip = ip
	
	auth_tokens.push(auth_token)
	return token
}

accounts = []

account = {}
account.username = 'steven'
account.pass = 'password'
accounts.push(account)

app.post(BASE + 'auth/new', function(req, resp){
	var username = req.query.username
	var pass = req.query.pass
	var ip = req.ip
	
	var token
	accounts.some(function(account){
		if(account.username == username && user.pass == pass){
			token = generateAuth(ip)
			return true
		}
	})
	
	if(token){
		var json = {}
		json.token = token
		resp.setHeader('Content-Type', 'application/json');
		resp.status(200)
		resp.send(token)
	}
	else{
		var json = {}
		json.error = 'Username or Password not valid'
		resp.setHeader('Content-Type', 'application/json');
		resp.status(403)
		resp.send(json)
	}
})

app.get(BASE + 'auth/check', function(req, resp){
	var token = req.query.token
	var ip = req.ip
	
	if(auth(token, ip)){
		var json = {}
		json.accepted = 'true'
		resp.setHeader('Content-Type', 'application/json');
		resp.status(200)
		resp.send(json)
	}
	else{
		var json = {}
		json.accepted = 'false'
		resp.setHeader('Content-Type', 'application/json');
		resp.status(200)
		resp.send(json)
	}
})



app.listen(8090)

console.log('Loaded')