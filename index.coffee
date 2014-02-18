
ModalDialog = require 'voxel-modal-dialog'
Inventory = require 'inventory'
InventoryWindow = require 'inventory-window'

module.exports = (game, opts) ->
  return new Furnace(game, opts)

module.exports.pluginInfo =
  loadAfter: ['voxel-registry', 'voxel-recipes', 'voxel-carry']

class Furnace
  constructor: (@game, opts) ->
    opts ?= {}

    @playerInventory = game.plugins?.get('voxel-carry')?.inventory ? opts.playerInventory ? throw new Error('voxel-furnace requires "voxel-carry" plugin or "playerInventory" set to inventory instance')
    @registry = game.plugins?.get('voxel-registry') ? throw new Error('voxel-furnace requires "voxel-registry" plugin')
    @recipes = game.plugins?.get('voxel-recipes') ? throw new Error('voxel-furnace requires "voxel-recipes" plugin')

    opts.registerBlock ?= true
    opts.registerRecipe ?= true
   
    if @game.isClient
      @furnaceDialog = new FurnaceDialog(game, @playerInventory, @registry, @recipes)

    @opts = opts
    @enable()

  enable: () ->
    if @opts.registerBlock
      @registry.registerBlock 'furnace', {texture: ['furnace_top', 'cobblestone', 'furnace_front_on'], onInteract: () =>
        # TODO: server-side
        @furnaceDialog.open()
        true
      }

    if @opts.registerRecipe
      @recipes.registerAmorphous(['cobblestone', 'cobblestone', 'cobblestone', 'cobblestone'], ['furnace'])

  disable: () ->
    # TODO


# TODO: major refactor with voxel-workbench!
class FurnaceDialog extends ModalDialog
  constructor: (@game, @playerInventory, @registry, @recipes) ->
    # TODO: refactor with voxel-inventory-dialog
    @playerIW = new InventoryWindow {width: 10, registry:@registry, inventory:@playerInventory}

    # TODO: clear these inventories on close, or store in per-block metadata
    
    @burnInventory = new Inventory(1)
    #@burnInventory.on 'changed', () => @updateCraftingRecipe()
    @burnIW = new InventoryWindow {width:1, registry:@registry, inventory:@burnInventory, linkedInventory:@playerInventory}

    @fuelInventory = new Inventory(1)
    #@fuelInventory.on 'changed', 
    @fuelIW = new InventoryWindow {width:1, registry:@registry, inventory:@fuelInventory, linkedInventory:@playerInventory}

    @resultInventory = new Inventory(1)
    @resultIW = new InventoryWindow {inventory:@resultInventory, registry:@registry, allowDrop:false, linkedInventory:@playerInventory}
    @resultIW.on 'pickup', () => @tookSmeltOutput()

    # burn + fuel + result div, upper
    crDiv = document.createElement('div')
    crDiv.style.marginLeft = '30%'
    #crDiv.style.marginLeft = 'auto' # TODO: fix centering
    #crDiv.style.marginRight = 'auto'
    crDiv.style.marginBottom = '10px'
  
    burnCont = @burnIW.createContainer()
    fuelCont = @fuelIW.createContainer()

    resultCont = @resultIW.createContainer()
    resultCont.style.marginLeft = '30px'
    resultCont.style.marginTop = '15%'

    crDiv.appendChild(burnCont)
    crDiv.appendChild(fuelCont)
    crDiv.appendChild(resultCont)

    contents = []
    contents.push crDiv
    contents.push document.createElement('br') # TODO: better positioning
    # player inventory at bottom
    contents.push @playerIW.createContainer()

    super game, {contents: contents}

  # TODO: refactor again from voxel-inventory-dialog's crafting

  updateSmeltingRecipe: () ->
    #recipe = @recipes.find(@craftInventory)
    #console.log 'found recipe',recipe
    #@resultInventory.set 0, recipe?.computeOutput(@craftInventory)
    # TODO

  # picked up smelting recipe output
  tookSmeltOutput: () ->
    #recipe = @recipes.find(@craftInventory)
    #return if not recipe?

    #recipe.craft(@craftInventory)
    #@craftInventory.changed()
    # TODO?

  close: () ->

    super()


