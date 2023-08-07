// Create web server
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const { randomBytes } = require('crypto');
const axios = require('axios');

const commentsByPostId = {};

// Parse the body of the request
app.use(bodyParser.json());
app.use(cors());

// Get comments for a given post
app.get('/posts/:id/comments', (req, res) => {
    const postId = req.params.id;
    const comments = commentsByPostId[postId] || [];
    res.status(200).send(comments);
});

// Create a new comment for a given post
app.post('/posts/:id/comments', async (req, res) => {
    const postId = req.params.id;
    const id = randomBytes(4).toString('hex');
    const { content } = req.body;

    const comments = commentsByPostId[postId] || [];
    comments.push({ id, content, status: 'pending' });
    commentsByPostId[postId] = comments;

    // Emit event to event bus
    await axios.post('http://event-bus-srv:4005/events', {
        type: 'CommentCreated',
        data: {
            id,
            postId,
            content,
            status: 'pending'
        }
    });

    res.status(201).send(comments);
});

// Receive events from event-bus
app.post('/events', async (req, res) => {
    console.log('Event Received: ', req.body.type);

    const { type, data } = req.body;

    if (type === 'CommentModerated') {
        const { postId, id, status, content } = data;

        const comments = commentsByPostId[postId];
        const comment = comments.find(comment => {
            return comment.id === id;
        });

        comment.status = status;

        await axios.post('http://event-bus-srv:4005/events', {
            type: 'CommentUpdated',
            data: {
                id,
                postId,
                content,
                status
            }
        });
    }

    res.send({});
});

// Start server
app.listen(4001, () => {
    console.log('Comments service listening on port 4001');
});