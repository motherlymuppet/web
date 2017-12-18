const express = require('express')
var app = express()
var request = require('requestify')

var bodyParser = require('body-parser')
app.use( bodyParser.json() );       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
  extended: true
}));


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

app.get('/', function(req, resp){
	console.log('GET /')
	resp.redirect(BASE)
})

app.get(BASE + 'venues', function(req, resp){
	console.log('GET venues')
	var json = {}
	json.venues = {}
	venues.forEach(function(venue) {
		json.venues[venue.venue_id] = venue
	})
	resp.setHeader('Content-Type', 'application/json')
	resp.status(200)
	resp.send(json)
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
	
	if(!search && !date){
		console.log('GET request sent to eventful')
		request.get('http://api.eventful.com/json/events/search?app_key=xtMtCvcT3wV44JWN&keywords=concertina&location=United+Kingdom').then(function(response){
			console.log('Response Received')
			var extEvents = JSON.parse(response.body).events.event
			extEvents.forEach(function(e){
				var id = e.id
				console.log(id)
				var title = e.title
				var blurb = e.description
				var date = e.start_time
				var url = e.url
				var venue_id = e.venue_id
				var venue_name = e.venue_name
				var venue_postcode = e.postal_code
				var venue_town = e.region_abbr
				var venue_url = e.venue_url
				var venue = new Venue(venue_id, venue_name, venue_postcode, venue_town, venue_url, '')
				var event = new Event(id, title, blurb, date, url, venue)
				json.push(event)
			})
			resp.setHeader('Content-Type', 'application/json')
			resp.status(200)
			resp.send(json)
		})
	}
	else{
		resp.setHeader('Content-Type', 'application/json')
		resp.status(200)
		resp.send(json)
	}
})

app.get(BASE + 'events/get/:event_id', function(req, resp) {
	console.log('GET events/get/:id')
	var id = req.params.event_id
	var found = false
	
	events.some(function(event) {
		if(event.event_id == id){
			resp.setHeader('Content-Type', 'application/json')
			resp.status(200)
			resp.send(event)
			found = true
			return true
		}
	})
	
	if(!found){
	var json = {}
		json.error = 'no such event'
		resp.setHeader('Content-Type', 'application/json')
		resp.status(404)
		resp.send(json)
	}
})

app.post(BASE + 'venues/add', function(req, resp) {
	console.log('POST venues/add')
	
	var auth_token = req.body.auth_token
	var ip = req.ip
	
	var name = req.body.name
	var postcode = req.body.postcode
	var town = req.body.town
	var url = req.body.url
	var icon = req.body.icon
	
	if(auth(auth_token, ip)){
		var last_id = venues[venues.length - 1].venue_id
		var id = 'v_' + (parseInt(last_id.substring(2,last_id.length), 10) + 1)
		var venue = new Venue(id, name, postcode, town, url, icon)
		venues.push(venue)
		var json = {}
		json.success = 'successful'
		resp.setHeader('Content-Type', 'application/json')
		resp.status(200)
		resp.send(json)
		console.log('POST venues/add success')
	}
	else{
		var json = {}
		json.error = 'not authorised, wrong token'
		resp.setHeader('Content-Type', 'application/json')
		resp.status(401)
		resp.send(json)
		console.log('POST venues/add fail')
	}
})

function maxId(){
	return Math.max.apply(null, events.map(function(event){
		var id = event.event_id
		return id.substring(2,id.length)
	}))
}

app.post(BASE + 'events/add', function(req, resp) {
	console.log('POST events/add')
	
	var auth_token = req.body.auth_token
	var ip = req.ip
	
	var event_id = req.body.event_id
	var title = req.body.title
	var venue_id = req.body.venue_id
	var date = req.body.date
	var url = req.body.url
	var blurb = req.body.blurb
	
	if(auth(auth_token, ip)){
		if(!event_id){
			event_id = 'e_' + (maxId()+1)
		}
		
		var venue
		venues.some(function(v) {
			if(v.venue_id == venue_id){
				venue = v
				return true
			}
		})
		
		if(venue){
			events = events.filter(function(event) { return event.id != event_id })
			var event = new Event(event_id, title, blurb, date, url, venue)
			events.push(event)
			var json = {}
			json.success = 'successful'
			resp.setHeader('Content-Type', 'application/json')
			resp.status(200)
			resp.send(json)
		}
		else{
			var json = {}
			json.error = 'venue not found'
			resp.setHeader('Content-Type', 'application/json')
			resp.status(400)
			resp.send(json)
		}
	}
	else{
		var json = {}
		json.error = 'not authorised, wrong token'
		resp.setHeader('Content-Type', 'application/json')
		resp.status(401)
		resp.send(json)
	}
})


venues.push(new Venue('v_1', 'DSU', 'DH4 6DW', 'Durham', 'www.google.com', 'http://umac.dixie.edu/wp-content/uploads/sites/116/2017/02/DSU-Logo-02.png'))
venues.push(new Venue('v_2', 'Home', 'DH1 1EP', 'Bournmoor', 'www.google.com', 'https://upload.wikimedia.org/wikipedia/commons/a/a1/Church_of_St_Barnabas%2C_Bournmoor.jpg'))

events.push(new Event('e_1', 'Fun times at steven\'s house', 'Have some fun times', '2018-05-21T16:00:00Z', 'www.google.com', venues[1]))
events.push(new Event('e_2', 'After Party party', 'Have some more fun times', '2018-05-21T22:00:00Z', 'www.google.com', venues[0]))
events.push(new Event('e_3', 'After Party party', 'Have some more fun times', '2018-05-21T22:00:00Z', 'www.google.com', venues[0]))
events.push(new Event('e_4', 'After Party party', 'Have some more fun times', '2018-05-21T22:00:00Z', 'www.google.com', venues[0]))
events.push(new Event('e_5', 'After Party party', 'Have some more fun times', '2018-05-21T22:00:00Z', 'www.google.com', venues[0]))



accounts = []
function Account (user, pass) {
	this.user = user;
	this.pass = pass;
}
accounts.push(new Account('steven', 'pass'))

tokens = []
function Token (ip, token, expiry) {
	this.ip = ip
	this.token = token
	this.expiry = expiry
}

app.post(BASE + 'auth/new', function(req, resp) {
	console.log('POST auth')
	var user = req.body.user
	var pass = req.body.pass
	console.log(user)
	console.log(pass)
	
	var accept = accounts.some(function(account){
		return account.user == user && account.pass == pass
	})
	
	if(accept){
		var ip = req.query.ip
		if(!ip){
			ip = req.ip
		}
		
		var token = uuid()
		var expiry = new Date()
		expiry.setHours(expiry.getHours() + 2)
		
		var auth_token = new Token(ip, token, expiry)
		tokens.push(auth_token)
		
		var json = {}
		json.token = token
		resp.setHeader('Content-Type', 'application/json')
		resp.status(200)
		resp.send(json)
		console.log('POST auth success')
	}
	else{
		var json = {}
		json.error = 'not authorised, username or password incorrect'
		resp.setHeader('Content-Type', 'application/json')
		resp.status(401)
		resp.send(json)
		console.log('POST auth fail')
	}
})

app.get(BASE + 'auth/check', function(req, resp) {
	console.log('GET auth')
	
	var token = req.query.token
	var ip = req.ip
	
	if(auth(token, ip)){
		var json = {}
		json.valid = true
		resp.setHeader('Content-Type', 'application/json')
		resp.status(200)
		resp.send(json)
	}
	else{
		var json = {}
		json.valid = false
		json.error = 'not authorised, username or password incorrect'
		resp.setHeader('Content-Type', 'application/json')
		resp.status(200)
		resp.send(json)
	}
})

//https://stackoverflow.com/questions/105034/create-guid-uuid-in-javascript
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function auth(token, ip){
	console.log('AUTH from ' + ip + ' with token ' + token)
	console.log('WARNING AUTH DISABLED')
	return true
	
	if(ip.startsWith('129.234')){
		if(token == 'concertina'){
			console.log('AUTH success')
			return true
		}
	}
	
	var found = false
	tokens.some(function(auth_token){
		if(auth_token.token == token){
			if(auth_token.ip == ip){
				var date = new Date()
				var dif = date.getDate() - auth_token.expiry.getDate()
				if(dif < 1000 * 3600 * 2){
					found = true
					return true
				}
			}
		}
	})
	
	if(found){
		console.log('AUTH success')
	}
	else{
		console.log('AUTH fail')
	}
	
	return found
}

app.listen(8090)

console.log('Loaded')