Part of the Agoric strategy for providing security is based on the
[Formal Methods](https://agoric.com/papers/#formal-reasoning) literature, which has developed tools
for proving that programs follow their specifications. There have been interesting advances in this
area including the development of [seL4](https://sel4.systems/Info/FAQ/proof.pml) and the
[proof of its correctness](https://sel4.systems/Info/FAQ/proof.pml). We have been collaborating with
a research group at Victoria University who are investigating how to apply these techniques to
secure distributed programs.

The work with Victoria University
[Reasoning about Risk and Trust in an Open World](https://ai.google/research/pubs/pub44272) has
resulted in development of a specification language, Chainmail, which is intended to allow programs
to be described with enough formality to investigate their security properties. We have used a
variant of the language to describe some of the core modules of
ERTP. [assays](https://github.com/Agoric/ERTP/blob/master/core/assays.chainmail),
[contractHost](https://github.com/Agoric/ERTP/blob/master/core/contractHost.chainmail),
[issuers](https://github.com/Agoric/ERTP/blob/master/core/issuers.chainmail).

We have several ideas for making use of chainmail descriptions in addition to formal proofs:

* We might enable our CapTP protocol to detect and enforce compliance with object interfaces
* Generate TypeScript code to cross-check type consistency
* Validate inter-object calls within Vats using membranes
* Generate Capn Proto adapters and bindings for other languages

We have a simple parser (which produces a parse tree, but doesn't make any use of it at this
point.) To validate the format of a chainmail file, you can run the parser against it.

```bash
git clone -b chainmail https://github.com/Agoric/jessica
npm install
jessica/lang/nodejs/cmparse.bat [single .chainmail file]
```




