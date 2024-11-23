# The Muffin Programming Language

**Note: WORK IN PROGRESS**

**Muffin** is a brand new **programming language** designed and implemented by
me in order to participate in [High Seas hold by Hack Club][high-seas].

Muffin allows you to write programs that look like **cooking recipes**.

Here is "Hello, world!" in Muffin:

```
Muffin recipe
ingredients
    "Hello, world!" brand Flour
method
    1. set up a Bowl
    2. add Flour into Bowl
    3. place Bowl in the oven and bake at 218C
    4. serves 1
```

And this prints out the first 20 Fibonacci numbers:

```
Muffin recipe
ingredients
    1 Blueberry
    20 grams of Butter
method
    1. set up 4 Bowls
    2. add Blueberry into 3rd Bowl
    3. dilute contents of 1st Bowl with an equal amount of water
    4. pour half of contents of 1st Bowl into 4th Bowl
    5. remove Butter from 4th Bowl
    6. if 4th Bowl is empty, proceed to step 15
    7. place 3rd Bowl in the oven and bake at 190C
    8. clean 4th Bowl
    9. pour contents of 2nd Bowl into 4th Bowl
    10. dilute contents of 3rd Bowl with an equal amount of water
    11. pour half of contents of 3rd Bowl into 2nd Bowl
    12. pour contents of 4th Bowl into 3rd Bowl
    13. add Blueberry into 1st Bowl
    14. go back to step 3
    15. serves 1
```

[high-seas]: https://highseas.hackclub.com/

## FAQ

### What's the purpose?

**Because it's fun!** If you haven't tried before, compilers and programming
languages might be something you will get interested in.

Muffin is an *esoteric programming language* (a.k.a. *esolang*). These
languages are not intended for real life projects, but mostly for conducting
research or for fun.

You can find a bunch of esolangs on the [esolang wiki][esolang-wiki].

[esolang-wiki]: https://esolangs.org/wiki/Main_Page

### How did you come up with this idea?

[Chef][chef] is also a programming language that allows you to write delicious
programs, which has quite different design compared to Muffin. But that
inspired me to create Muffin. The [Fibonacci program in Chef][chef-fibo] took
34 lines of code, and an additional 6 declaration lines ("ingredients"), while
the same program in Muffin used 17 lines. In that regard, Muffin *might* be a
more concise language.

[chef]: https://www.dangermouse.net/esoteric/chef.html
[chef-fibo]: https://www.dangermouse.net/esoteric/chef_fib.html
