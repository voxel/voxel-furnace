'use strict';

const InventoryDialog = require('voxel-inventory-dialog').InventoryDialog;
const Inventory = require('inventory');
const InventoryWindow = require('inventory-window');
const ItemPile = require('itempile');

module.exports = (game, opts) => new Furnace(game, opts);

module.exports.pluginInfo = {
  loadAfter: ['voxel-registry', 'voxel-recipes', 'voxel-carry', 'voxel-blockdata']
};

class Furnace {
  constructor(game, opts) {
    this.game = game;

    if (!opts) opts = {};

    this.playerInventory = game.plugins.get('voxel-carry').inventory || opts.playerInventory; // TODO: proper error if voxel-carry missing
    if (!this.playerInventory) throw new Error('voxel-inventory-dialog requires "voxel-carry" plugin or playerInventory" set to inventory instance');

    this.registry = game.plugins.get('voxel-registry');
    if (!this.registry) throw new Error('voxel-furnace requires "voxel-registry" plugin');

    this.recipes = game.plugins.get('voxel-recipes');
    if (!this.recipes) throw new Error('voxel-furnace requires "voxel-recipes" plugin');

    if (this.recipes.registerSmelting === undefined) throw new Error('voxel-furnace requires voxel-recipes with smelting recipes');

    this.blockdata = game.plugins.get('voxel-blockdata');
    if (!this.blockdata) throw new Error('voxel-furnace requires "voxel-blockdata plugin');

    if (opts.registerBlock === undefined) opts.registerBlock = true;
    if (opts.registerRecipe === undefined) opts.registerRecipe = true;
    if (opts.registerItems === undefined) opts.registerItems = true;
    if (opts.registerRecipes === undefined) opts.registerRecipes = true;

    if (this.game.isClient) {
      this.furnaceDialog = new FurnaceDialog(game, this.playerInventory, this.registry, this.recipes, this.blockdata);
    }

    this.opts = opts;
    this.enable();
  }

  enable() {
    if (this.opts.registerBlock) {
      this.registry.registerBlock('furnace', {texture: ['furnace_top', 'cobblestone', 'furnace_front_on'], onInteract: (target) => {
        // TODO: server-side
        this.furnaceDialog.open(target);
        return true;
      }});
    }

    if (this.opts.registerRecipe) {
      this.recipes.registerPositional([
        ['cobblestone', 'cobblestone', 'cobblestone'],
        ['cobblestone', undefined, 'cobblestone'],
        ['cobblestone', 'cobblestone', 'cobblestone']], ['furnace']);
    }

    if (this.opts.registerItems) {
      this.registry.registerItem('ingotIron', {itemTexture: 'i/iron_ingot', displayName: 'Iron Ingot'});
      this.registry.registerItem('nugget', {itemTexture: 'i/gold_nugget', displayName: 'Nugget'}); // TODO: iron_nugget, mod texture
    }

    if (this.opts.registerRecipes) {
      this.recipes.registerSmelting('oreIron', new ItemPile('ingotIron')); // TODO: move to voxel-land?
      this.recipes.registerSmelting('oreCoal', new ItemPile('coal'));
      this.recipes.registerSmelting('cobblestone', new ItemPile('stone'));
      this.recipes.registerAmorphous(['ingotIron'], new ItemPile('nugget', 9));
      this.recipes.registerPositional([
          ['nugget', 'nugget', 'nugget'],
          ['nugget', 'nugget', 'nugget'],
          ['nugget', 'nugget', 'nugget']], new ItemPile('ingotIron'));
    }
  }

  disable() {
    // TODO
  }
}

class FurnaceDialog extends InventoryDialog {
  constructor(game, playerInventory, registry, recipes, blockdata) {

    const burnInventory = new Inventory(1);
    const burnIW = new InventoryWindow({width:1, registry:registry, inventory:burnInventory, linkedInventory:playerInventory});

    const fuelInventory = new Inventory(1);
    const fuelIW = new InventoryWindow({width:1, registry:registry, inventory:fuelInventory, linkedInventory:playerInventory});

    const resultInventory = new Inventory(1);
    const resultIW = new InventoryWindow({inventory:resultInventory, registry:registry, allowDrop:false, linkedInventory:playerInventory});

    // align as follows:
    // +---------------------------------+
    // |     [burn]                      |
    // |             --->  [result]      |
    // |     [fuel]                      |
    // +---------------------------------+

    // TODO: fix float:right in voxel-inventory-dialog; would prefer it centered (remove float, but make sure not to break voxel-inventory-crafting)
    const allDiv = document.createElement('div');
    allDiv.style.display = 'flex';
    allDiv.style.justifyContent = 'center';
    allDiv.style.width = '100%';
  
    const burnCont = burnIW.createContainer();
    const fuelCont = fuelIW.createContainer();
    const resultCont = resultIW.createContainer();

    burnCont.style.display = 'flex';
    burnCont.style.flex = '1';

    fuelCont.style.display = 'flex';

    resultCont.style.display = 'flex';
    resultCont.style.flexFlow = 'column';
    resultCont.style.justifyContent = 'center';

    // burn and fuel div
    const bfDiv = document.createElement('div');
    bfDiv.style.display = 'flex';
    bfDiv.style.flexFlow = 'column';
    bfDiv.style.paddingTop = '10px';
    bfDiv.style.paddingRight = '50px';  // give some space between result slot

    bfDiv.appendChild(burnCont);
    bfDiv.appendChild(fuelCont);


    allDiv.appendChild(bfDiv);
    allDiv.appendChild(resultCont);

    super(game, {
      playerLinkedInventory: burnInventory, // TODO: allow selectively linking to burn or fuel inv, depending on item type!
      upper: [allDiv]
    });

    this.game = game;
    this.playerInventory = playerInventory;
    this.registry = registry;
    this.recipes = recipes;
    this.blockdata = blockdata;

    // TODO: clear these inventories on close, or store in per-block metadata
    this.burnInventory = burnInventory;
    this.burnInventory.on('changed', () => this.updateSmelting());
    this.burnIW = burnIW;
    this.fuelInventory = fuelInventory;
    this.fuelInventory.on('changed', () => this.updateSmelting());
    this.fuelIW = fuelIW;
    this.resultInventory = resultInventory;
    this.resultIW = resultIW;
    this.resultIW.on('pickup', () => this.updateSmelting());
  }

  updateSmelting() {
    if (this.isSmelting) return; // prevent recursion
    this.isSmelting = true;

    while (true) {
      if (!this.isFuel(this.fuelInventory.get(0))) return;

      const smeltedOutput = this.recipes.smelt(this.burnInventory.get(0));
      if (smeltedOutput === undefined) break; // not smeltable

      if (this.resultInventory.get(0) && (this.resultInventory.get(0).item !== smeltedOutput.item || this.resultInventory.get(0).count == 64)) return; // not empty or stackable or no space

      console.log(`smelting: ${this.fuelInventory} + ${this.burnInventory} = ${this.resultInventory}`);

      const fuel = this.fuelInventory.takeAt(0, 1);
      const burn = this.burnInventory.takeAt(0, 1); // TODO: custom burn amounts TODO: finite burn times

      this.resultInventory.give(smeltedOutput);
      
      console.log(`smelted: ${this.fuelInventory} + ${this.burnInventory} = ${this.resultInventory}`);
      }

    this.isSmelting = false;
    this.updateBlockdata();
    }

  isFuel(itemPile) {
    if (!itemPile) return false;
    const props = this.registry.getItemProps(itemPile.item);
    if (!props) return false;

    const fuelBurnTime = props.fuelBurnTime;
    if (!fuelBurnTime) return false;

    return true; // TODO: return burn time instead, and use variable length smelting times (GH-4)
  }

  // persistence
  // TODO: refactor with voxel-chest and cleanup
  loadBlockdata(x, y, z) {
    let bd = this.blockdata.get(x, y, z);
    if (bd !== undefined) {
      this.burnInventory.set(0, ItemPile.fromString(bd.burn !== undefined ? bd.burn : ''));
      this.fuelInventory.set(0, ItemPile.fromString(bd.fuel !== undefined ? bd.fuel : ''));
      this.resultInventory.set(0, ItemPile.fromString(bd.result !== undefined ? bd.result : ''));
    } else {
      bd = {
        burn:this.burnInventory.get(0) ? this.burnInventory.get(0).toString() : undefined,
        fuel:this.fuelInventory.get(0) ? this.fuelInventory.get(0).toString() : undefined,
        result:this.resultInventory.get(0) ?  this.resultInventory.get(0).toString() : undefined
      };
      this.blockdata.set(x, y, z, bd);
    }

    this.activeBlockdata = bd;
    console.log('load bd',x,y,z,JSON.stringify(this.activeBlockdata));
  }

  updateBlockdata() {
    console.log(`burn=${this.burnInventory}, fuel=${this.fuelInventory}, result=${this.resultInventory}`);

    if (this.activeBlockdata === undefined) return;
    this.activeBlockdata.burn = this.burnInventory.get(0) ? this.burnInventory.get(0).toString() : undefined;
    this.activeBlockdata.fuel = this.fuelInventory.get(0) ? this.fuelInventory.get(0).toString() : undefined;
    this.activeBlockdata.result = this.resultInventory.get(0) ? this.resultInventory.get(0).toString() : undefined;
    console.log('update bd',JSON.stringify(this.activeBlockdata));
  }

  open(target) {
    const x = target.voxel[0];
    const y = target.voxel[1];
    const z = target.voxel[2];
    this.loadBlockdata(x, y, z);

    super.open();
  }

  close() {
    delete this.activeBlockdata;
    this.burnInventory.clear();
    this.fuelInventory.clear();
    this.resultInventory.clear();
    super.close();
  }
}
