const express = require('express');
const router = express.Router();

// Load Page model
const Page = require('../models/Page');
// const { forwardAuthenticated } = require('../config/auth');

router.get('/', (req, res) => {
  if(req.user.role != 'admin') {
    return res.status(404).send("Page not found");
  }
  let allPages = Page.find()
    .sort({ _id: -1 })
    .then(pages => {
      res.render("pages/index", {
        user: req.user,
        pages: pages
      });
    })
    .catch(err => console.log(err));
});

router.get('/add', (req, res) => {
  res.render('pages/add');
})

router.post('/add', (req, res) => {
  let errors = [];
  const { title, menu, status, content, submitPage } = req.body;
  if(submitPage === 'submited') {
    if (!title || !menu || !status || !content) {
      errors.push({ msg: 'Please enter all fields' });
    }
  } else {
    errors.push({ msg: 'Please enter all fields' });
  }

  if (errors.length > 0) {
    res.render('pages/add', {
      errors,
      title,
      menu,
      status,
      content
    });
  } else {
    let slug = convertToSlug(title);
    const newPage = new Page({
            title,
            slug,
            menu,
            status,
            content
          });

    newPage.save()
        .then(page => {
            req.flash(
              'success_msg',
              'New page has been added'
            );
            res.redirect('/pages');
          })
        .catch(err => console.log(err));
  }
});

// Edit
router.get('/edit/:id', (req, res) => {
  let pageId = req.params.id;
  Page.findOne({ _id: pageId }).then(page => {
      if (page) {
        res.render('pages/edit', {
          page
        });
      }
    }).catch(err => {
      if(err) {
        res.status(404).send("Page not found")
      }
    });
});

// Update
router.post('/update', (req, res) => {
  let errors = [];
  const { _id, title, menu, status, content, submitPage } = req.body;
  if(submitPage === 'submited') {
    if (!_id || !title || !menu || !status || !content) {
      errors.push({ msg: 'Please enter all fields' });
    }
  } else {
    errors.push({ msg: 'Please enter all fields' });
  }

  if (errors.length > 0) {
      req.flash("error_msg", "Please enter all fields");
      res.redirect(`/pages/edit/${_id}`);
  } else {
    Page.findByIdAndUpdate(_id, {
        title,
        menu,
        status,
        content
    }).then(page => {
        req.flash(
          'error_msg',
          'Page has been updated'
        );
        res.redirect('/pages');
    })
    .catch(err => {
      if(err) {
        res.status(404).send('Page not found.');
      }
    });
  }
});

// Delere
router.get('/delete/:id', (req, res) => {
  let pageId = req.params.id;
  Page.deleteOne({_id: pageId}).then(result => {
    req.flash('success_msg', 'Page has been deleted');
    res.redirect('/pages');
  }).catch(err => {
    if(err) {
      res.status(404).send("Page not found")
    }
  })
});

router.get('/:slug', (req, res) => {
  let pageSlug = req.params.slug;
  Page.findOne({ slug: pageSlug }).then(page => {
      if (page) {
        res.render('pages/single', {
          page
        });
      }
    }).catch(err => {
      if(err) {
        res.status(404).send("Page not found")
      }
    });
});

function convertToSlug(Text) {
    return Text
        .toLowerCase()
        .replace(/ /g,'-')
        .replace(/[^\w-]+/g,'')
        ;
}

module.exports = router;
