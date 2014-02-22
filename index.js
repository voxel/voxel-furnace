// Generated by CoffeeScript 1.7.0
(function() {
  var Furnace, FurnaceDialog, Inventory, InventoryDialog, InventoryWindow, ItemPile,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  InventoryDialog = (require('voxel-inventory-dialog')).InventoryDialog;

  Inventory = require('inventory');

  InventoryWindow = require('inventory-window');

  ItemPile = require('itempile');

  module.exports = function(game, opts) {
    return new Furnace(game, opts);
  };

  module.exports.pluginInfo = {
    loadAfter: ['voxel-registry', 'voxel-recipes', 'voxel-carry']
  };

  Furnace = (function() {
    function Furnace(game, opts) {
      var _ref, _ref1, _ref2;
      this.game = game;
      if (opts == null) {
        opts = {};
      }
      this.playerInventory = (function() {
        var _ref1, _ref2, _ref3;
        if ((_ref = (_ref1 = (_ref2 = game.plugins) != null ? (_ref3 = _ref2.get('voxel-carry')) != null ? _ref3.inventory : void 0 : void 0) != null ? _ref1 : opts.playerInventory) != null) {
          return _ref;
        } else {
          throw new Error('voxel-furnace requires "voxel-carry" plugin or "playerInventory" set to inventory instance');
        }
      })();
      this.registry = (function() {
        var _ref2;
        if ((_ref1 = (_ref2 = game.plugins) != null ? _ref2.get('voxel-registry') : void 0) != null) {
          return _ref1;
        } else {
          throw new Error('voxel-furnace requires "voxel-registry" plugin');
        }
      })();
      this.recipes = (function() {
        var _ref3;
        if ((_ref2 = (_ref3 = game.plugins) != null ? _ref3.get('voxel-recipes') : void 0) != null) {
          return _ref2;
        } else {
          throw new Error('voxel-furnace requires "voxel-recipes" plugin');
        }
      })();
      if (this.recipes.registerSmelting == null) {
        throw new Error('voxel-furnace requires voxel-recipes with smelting recipes');
      }
      if (opts.registerBlock == null) {
        opts.registerBlock = true;
      }
      if (opts.registerRecipe == null) {
        opts.registerRecipe = true;
      }
      if (opts.registerItems == null) {
        opts.registerItems = true;
      }
      if (opts.registerRecipes == null) {
        opts.registerRecipes = true;
      }
      if (this.game.isClient) {
        this.furnaceDialog = new FurnaceDialog(game, this.playerInventory, this.registry, this.recipes);
      }
      this.opts = opts;
      this.enable();
    }

    Furnace.prototype.enable = function() {
      if (this.opts.registerBlock) {
        this.registry.registerBlock('furnace', {
          texture: ['furnace_top', 'cobblestone', 'furnace_front_on'],
          onInteract: (function(_this) {
            return function() {
              _this.furnaceDialog.open();
              return true;
            };
          })(this)
        });
      }
      if (this.opts.registerRecipe) {
        this.recipes.registerPositional([['cobblestone', 'cobblestone', 'cobblestone'], ['cobblestone', void 0, 'cobblestone'], ['cobblestone', 'cobblestone', 'cobblestone']], ['furnace']);
      }
      if (this.opts.registerItems) {
        this.registry.registerItem('ingotIron', {
          itemTexture: 'i/iron_ingot'
        });
      }
      if (this.opts.registerRecipes) {
        this.recipes.registerSmelting('oreIron', new ItemPile('ingotIron'));
        return this.recipes.registerSmelting('oreCoal', new ItemPile('coal'));
      }
    };

    Furnace.prototype.disable = function() {};

    return Furnace;

  })();

  FurnaceDialog = (function(_super) {
    __extends(FurnaceDialog, _super);

    function FurnaceDialog(game, playerInventory, registry, recipes) {
      var allDiv, bfDiv, burnCont, fuelCont, resultCont;
      this.game = game;
      this.playerInventory = playerInventory;
      this.registry = registry;
      this.recipes = recipes;
      this.burnInventory = new Inventory(1);
      this.burnInventory.on('changed', (function(_this) {
        return function() {
          return _this.updateSmelting();
        };
      })(this));
      this.burnIW = new InventoryWindow({
        width: 1,
        registry: this.registry,
        inventory: this.burnInventory,
        linkedInventory: this.playerInventory
      });
      this.fuelInventory = new Inventory(1);
      this.fuelInventory.on('changed', (function(_this) {
        return function() {
          return _this.updateSmelting();
        };
      })(this));
      this.fuelIW = new InventoryWindow({
        width: 1,
        registry: this.registry,
        inventory: this.fuelInventory,
        linkedInventory: this.playerInventory
      });
      this.resultInventory = new Inventory(1);
      this.resultIW = new InventoryWindow({
        inventory: this.resultInventory,
        registry: this.registry,
        allowDrop: false,
        linkedInventory: this.playerInventory
      });
      this.resultIW.on('pickup', (function(_this) {
        return function() {
          return _this.updateSmelting();
        };
      })(this));
      allDiv = document.createElement('div');
      allDiv.style.display = 'flex';
      allDiv.style.justifyContent = 'center';
      allDiv.style.width = '100%';
      burnCont = this.burnIW.createContainer();
      fuelCont = this.fuelIW.createContainer();
      resultCont = this.resultIW.createContainer();
      burnCont.style.display = 'flex';
      burnCont.style.flex = '1';
      fuelCont.style.display = 'flex';
      resultCont.style.display = 'flex';
      resultCont.style.flexFlow = 'column';
      resultCont.style.justifyContent = 'center';
      bfDiv = document.createElement('div');
      bfDiv.style.display = 'flex';
      bfDiv.style.flexFlow = 'column';
      bfDiv.style.paddingTop = '10px';
      bfDiv.style.paddingRight = '50px';
      bfDiv.appendChild(burnCont);
      bfDiv.appendChild(fuelCont);
      allDiv.appendChild(bfDiv);
      allDiv.appendChild(resultCont);
      FurnaceDialog.__super__.constructor.call(this, game, {
        playerLinkedInventory: this.burnInventory,
        upper: [allDiv]
      });
    }

    FurnaceDialog.prototype.updateSmelting = function() {
      var burn, fuel, smeltedOutput;
      if (this.isSmelting) {
        return;
      }
      this.isSmelting = true;
      while (true) {
        if (!this.isFuel(this.fuelInventory.get(0))) {
          break;
        }
        smeltedOutput = this.recipes.smelt(this.burnInventory.get(0));
        if (smeltedOutput == null) {
          break;
        }
        if (this.resultInventory.get(0) && (this.resultInventory.get(0).item !== smeltedOutput.item || this.resultInventory.get(0).count === 64)) {
          break;
        }
        console.log("smelting: " + this.fuelInventory + " + " + this.burnInventory + " = " + this.resultInventory);
        fuel = this.fuelInventory.takeAt(0, 1);
        burn = this.burnInventory.takeAt(0, 1);
        this.resultInventory.give(smeltedOutput);
        console.log("smelted: " + this.fuelInventory + " + " + this.burnInventory + " = " + this.resultInventory);
      }
      return this.isSmelting = false;
    };

    FurnaceDialog.prototype.isFuel = function(itemPile) {
      if (!itemPile) {
        return false;
      }
      return itemPile.item === 'coal';
    };

    FurnaceDialog.prototype.close = function() {
      return FurnaceDialog.__super__.close.call(this);
    };

    return FurnaceDialog;

  })(InventoryDialog);

}).call(this);
