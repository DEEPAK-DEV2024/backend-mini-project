const express = require('express')
const app = express()

const userModel = require('./model/user')
const postModel = require('./model/post')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
const path = require('path')
const upload = require('./config/multerConfig')

app.use(cookieParser())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(express.static(path.join(__dirname, 'public')));

app.set('view engine', 'ejs');

app.get('/', (req, res) => {
    res.render('index')
})
app.post('/register', async (req, res) => {
    const { username, email, age, password } = req.body;
    const user = await userModel.findOne({ email })
    if (user) return res.status(300).send('user already exist');

    bcrypt.genSalt(10, (err, salt) => {
        bcrypt.hash(password, salt, async (err, hash) => {
            const createdUser = await userModel.create({
                username,
                email,
                age,
                password: hash
            })

            console.log(createdUser);

            const token = jwt.sign({ email }, 'hello');
            res.cookie('token', token)
            res.redirect('/profile')
        })
    })

})
app.get('/login', (req, res) => {
    res.render('login')
})
app.post('/login', async (req, res) => {

    const { email, password } = req.body;
    const user = await userModel.findOne({ email })
    if (!user) return res.status(500).send('something went wrong');

    bcrypt.compare(password, user.password, (err, result) => {
        if (result) {
            const token = jwt.sign({ email, userId: user._id }, 'hello')
            res.cookie('token', token)
            res.redirect('/profile')
        }
        else {
            res.send('something went wrong')
        }
    })

})

app.get('/profile', isLoggedIn, async (req, res) => {
    const user = await userModel.findOne({ email: req.user.email }).populate('posts');

    res.render('profile', { user })
})
app.get('/like/:id', isLoggedIn, async (req, res) => {
    const post = await postModel.findOne({ _id: req.params.id }).populate('userId');

    if (post.likes.indexOf(req.user.userId) === -1) {
        post.likes.push(req.user.userId)

    } else {
        post.likes.splice(post.likes.indexOf(req.user.userId), 1)
    }


    await post.save()

    console.log(post);
    res.redirect('/profile')
})
app.get('/edit/:id', isLoggedIn, async (req, res) => {
    const post = await postModel.findOne({ _id: req.params.id }).populate('userId');

    res.render('edit', { post })
})

app.post('/edit/:id', isLoggedIn, async (req, res) => {
    const post = await postModel.findOneAndUpdate({ _id: req.params.id }, { content: req.body.content }).populate('userId');
    await post.save()
    res.redirect('/profile')
})
app.post('/post', isLoggedIn, async (req, res) => {
    const user = await userModel.findOne({ email: req.user.email });
    const { content } = req.body;
    const createdPost = await postModel.create({
        userId: user._id,
        content
    })

    await user.posts.push(createdPost._id);
    await user.save();
    res.redirect('/profile')
})


app.get('/profile/upload', isLoggedIn, async (req, res) => {
    res.render('upload')
})
app.post('/profile/upload', isLoggedIn, upload.single('image'), async (req, res) => {
    const user = await userModel.findOne({ email: req.user.email })
    user.profilepic = req.file.filename
    await user.save()
    console.log(user);

    res.redirect('/profile')
})
app.get('/logout', (req, res) => {
    res.cookie('token', '')
    res.redirect('/')
})
function isLoggedIn(req, res, next) {
    if (req.cookies.token === "") {
        res.render('login')
    } else {
        let data = jwt.verify(req.cookies.token, 'hello');
        req.user = data
        next()
    }

}
app.listen(3000, (err) => {
    console.log('app running on http://localhost:3000');
})