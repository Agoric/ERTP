## Custom Mints and Other Configurations

The `makeMint` function in `issuers.js` takes in a configuration
function that can change a number of things about how mints, issuers,
purses, and payments are made. 

By default, `makeBasicFungibleConfig` is used. This creates a mint for
a fungible token with no custom methods.

But, imagine that we want to add a custom method to the `mint` object.
Maybe we want to be able to know how much has been minted so far. To
do so, we will need to create our own custom configuration. 

Our custom configuration will look like this:

```js
const makeTotalSupplyConfig = () => {

  function* makePaymentTrait(_superPayment) {
    yield harden({});
  }

  function* makePurseTrait(_superPurse) {
    yield harden({});
  }

  function* makeMintTrait(_superMint, _issuer, _assay, mintKeeper) {
    return yield harden({
      getTotalSupply: () => mintKeeper.getTotalSupply(),
    });
  }

  function* makeIssuerTrait(_superIssuer) {
    yield harden({});
  }

  return harden({
    makePaymentTrait,
    makePurseTrait,
    makeMintTrait,
    makeIssuerTrait,
    makeMintKeeper: makeTotalSupplyMintKeeper,
    strategy: natStrategy,
    makeMintTrait,
  });
};
```

In this custom configuration, we've done two things: we've added a
method to `mint` called `getTotalSupply`, and we've changed the
`mintKeeper` to a custom mintKeeper that keeps track of the total
supply for us (more on this in separate documentation). 

Let's take a look into how we are able to add new methods to mints,
issuers, purses, and payments. 

In `makePaymentTrait`, we take `superPayment` as a parameter. The
`superPayment` is constructed in `issuers.js` and has all of the
methods we are familiar with:

```js
const superPayment = harden({
  getIssuer() {
    return issuer;
  },
  getBalance() {
    return paymentKeeper.getAmount(payment);
  },
  getName() {
    return name;
  },
});
```

Our custom code, `makePaymentTrait`, returns an object with custom methods.
These methods will be added to the `superPayment`. For this particular
customization, we want to leave payments alone, so we will create a
generator function that yields an empty object:

```js
function* makePaymentTrait(_superPayment) {
  yield harden({});
}
```

However, we do want to add an extra method to mints. So,
`makeMintTrait` is defined as:

```js
function* makeMintTrait(_superMint, _issuer, _assay, mintKeeper) {
  return yield harden({
    getTotalSupply: () => mintKeeper.getTotalSupply(),
  });
}
```

Back in `issuers.js`, our custom methods will be combined with the
"core" methods already present. Here's how that works for our custom
mint methods:

```js
const makeMintTraitIter = makeMintTrait(coreMint, issuer, assay, mintKeeper);
const mintTrait = makeMintTraitIter.next().value;
const mint = harden({
  ...mintTrait,
  ...coreMint,
});
makeMintTraitIter.next(mint);
```

## The Trait Pattern

As a general rule, we do not want the customization code to be able to
override the methods already on the mints, issuers, purses or
payments. It would hardly be a standard if the standard methods acted
entirely differently! On the other hand, we do know that there is a
genuine need to have slightly different purposes expressed. 

This is why we've chosen to use the [Trait
pattern](https://traitsjs.github.io/traits.js-website/), in which
custom behavior can be defined and recombined easily. (Note: We don't
currently use the Trait.js infrastructure, but the philosophy is the
same.) Furthermore, if we always combine the methods such that the
"core" methods are last, they cannot be overridden by the custom
methods. 

So we're good, right? Well, almost.

## Why generator functions?

Sometimes, we want to burn the payment in the custom method. That
caused a problem, because without generators, we don't actually have
access to the payment! We only have access to the `superPayment` that
is passed in as a parameter. When we call `issuer.burnAll(payment)`,
the payment gets looked up in a WeakMap of all the payments and their
current balances. However, the superPayment won't be in that WeakMap.
The finished payment (the superPayment plus the custom methods) is
what is in the WeakMap. So we must have access to *that* payment. 

There's a contradiction there. We wanted to ensure that the custom
code couldn't override or mess with the core methods, but now we're
saying that we should hand off the whole, un-`hardened` payment to the
custom code. 

There's a way to get around this contradiction: generator functions.
We can still use the trait pattern. However, we can also give access
to the `hardened`, final version of the payment that is the core + custom methods.

Here's how that happens:

* temporal dead zone
* ??
