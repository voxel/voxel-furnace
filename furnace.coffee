
InventoryDialog = (require 'voxel-inventory-dialog').InventoryDialog
Inventory = require 'inventory'
InventoryWindow = require 'inventory-window'
ItemPile = require 'itempile'

module.exports = (game, opts) ->
  return new Furnace(game, opts)

module.exports.pluginInfo =
  loadAfter: ['voxel-registry', 'voxel-recipes', 'voxel-carry', 'voxel-blockdata']

class Furnace
  constructor: (@game, opts) ->
    opts ?= {}

    @playerInventory = game.plugins?.get('voxel-carry')?.inventory ? opts.playerInventory ? throw new Error('voxel-furnace requires "voxel-carry" plugin or "playerInventory" set to inventory instance')
    @registry = game.plugins?.get('voxel-registry') ? throw new Error('voxel-furnace requires "voxel-registry" plugin')
    @recipes = game.plugins?.get('voxel-recipes') ? throw new Error('voxel-furnace requires "voxel-recipes" plugin')
    throw new Error('voxel-furnace requires voxel-recipes with smelting recipes') if not @recipes.registerSmelting?
    @blockdata = game.plugins?.get('voxel-blockdata') ? throw new Error('voxel-furnace requires "voxel-blockdata plugin')

    opts.registerBlock ?= true
    opts.registerRecipe ?= true
    opts.registerItems ?= true
    opts.registerRecipes ?= true

    if @game.isClient
      @furnaceDialog = new FurnaceDialog(game, @playerInventory, @registry, @recipes, @blockdata)

    @opts = opts
    @enable()

  enable: () ->
    if @opts.registerBlock
      @registry.registerBlock 'furnace', {texture: ['furnace_top', 'cobblestone', 'furnace_front_on'], onInteract: (target) =>
        # TODO: server-side
        @furnaceDialog.open(target)
        true
      }

    if @opts.registerRecipe
      @recipes.registerPositional([
        ['cobblestone', 'cobblestone', 'cobblestone']
        ['cobblestone', undefined, 'cobblestone']
        ['cobblestone', 'cobblestone', 'cobblestone']], ['furnace'])

    if @opts.registerItems
      @registry.registerItem 'ingotIron', {itemTexture: 'i/iron_ingot', displayName: 'Iron Ingot'}
      @registry.registerItem 'nugget', {itemTexture: 'i/gold_nugget', displayName: 'Nugget'} # TODO: iron_nugget, mod texture

    if @opts.registerRecipes
      @recipes.registerSmelting 'oreIron', new ItemPile('ingotIron') # TODO: move to voxel-land?
      @recipes.registerSmelting 'oreCoal', new ItemPile('coal')
      @recipes.registerSmelting 'cobblestone', new ItemPile('stone')
      @recipes.registerAmorphous ['ingotIron'], new ItemPile('nugget', 9)
      @recipes.registerPositional [
          ['nugget', 'nugget', 'nugget'],
          ['nugget', 'nugget', 'nugget'],
          ['nugget', 'nugget', 'nugget']], new ItemPile('ingotIron')

  disable: () ->
    # TODO


class FurnaceDialog extends InventoryDialog
  constructor: (@game, @playerInventory, @registry, @recipes, @blockdata) ->
    # TODO: clear these inventories on close, or store in per-block metadata
    
    @burnInventory = new Inventory(1)
    @burnInventory.on 'changed', () => @updateSmelting()
    @burnIW = new InventoryWindow {width:1, registry:@registry, inventory:@burnInventory, linkedInventory:@playerInventory}

    @fuelInventory = new Inventory(1)
    @fuelInventory.on 'changed', () => @updateSmelting()
    @fuelIW = new InventoryWindow {width:1, registry:@registry, inventory:@fuelInventory, linkedInventory:@playerInventory}

    @resultInventory = new Inventory(1)
    @resultIW = new InventoryWindow {inventory:@resultInventory, registry:@registry, allowDrop:false, linkedInventory:@playerInventory}
    @resultIW.on 'pickup', () => @updateSmelting()

    # align as follows:
    # +---------------------------------+
    # |     [burn]                      |
    # |             --->  [result]      |
    # |     [fuel]                      |
    # +---------------------------------+

    # TODO: fix float:right in voxel-inventory-dialog; would prefer it centered (remove float, but make sure not to break voxel-inventory-crafting)
    allDiv = document.createElement('div')
    allDiv.style.display = 'flex'
    allDiv.style.justifyContent = 'center'
    allDiv.style.width = '100%'
  
    burnCont = @burnIW.createContainer()
    fuelCont = @fuelIW.createContainer()
    resultCont = @resultIW.createContainer()

    burnCont.style.display = 'flex'
    burnCont.style.flex = '1'

    fuelCont.style.display = 'flex'

    resultCont.style.display = 'flex'
    resultCont.style.flexFlow = 'column'
    resultCont.style.justifyContent = 'center'

    # burn and fuel div
    bfDiv = document.createElement 'div'
    bfDiv.style.display = 'flex'
    bfDiv.style.flexFlow = 'column'
    bfDiv.style.paddingTop = '10px'
    bfDiv.style.paddingRight = '50px'  # give some space between result slot

    bfDiv.appendChild(burnCont)
    bfDiv.appendChild(fuelCont)


    allDiv.appendChild(bfDiv)
    allDiv.appendChild(resultCont)

    super game,
      playerLinkedInventory: @burnInventory # TODO: allow selectively linking to burn or fuel inv, depending on item type!
      upper: [allDiv]

  updateSmelting: () ->
    return if @isSmelting # prevent recursion
    @isSmelting = true

    while true
      break if not @isFuel @fuelInventory.get(0)

      smeltedOutput = @recipes.smelt @burnInventory.get(0)
      break if not smeltedOutput?  # not smeltable

      break if @resultInventory.get(0) && (@resultInventory.get(0).item != smeltedOutput.item || @resultInventory.get(0).count == 64) # not empty or stackable or no space

      console.log "smelting: #{@fuelInventory} + #{@burnInventory} = #{@resultInventory}"

      fuel = @fuelInventory.takeAt(0, 1)
      burn = @burnInventory.takeAt(0, 1) # TODO: custom burn amounts TODO: finite burn times

      @resultInventory.give smeltedOutput
      
      console.log "smelted: #{@fuelInventory} + #{@burnInventory} = #{@resultInventory}"

    @isSmelting = false
    @updateBlockdata()

  isFuel: (itemPile) ->
    return false if not itemPile
    props = @registry.getItemProps itemPile.item
    return false if not props

    fuelBurnTime = props.fuelBurnTime
    return false if not fuelBurnTime

    return true # TODO: return burn time instead, and use variable length smelting times (GH-4)

  # persistence
  # TODO: refactor with voxel-chest and cleanup
  loadBlockdata: (x, y, z) ->
    bd = @blockdata.get x, y, z
    if bd?
      @burnInventory.set 0, ItemPile.fromString(bd.burn ? '')
      @fuelInventory.set 0, ItemPile.fromString(bd.fuel ? '')
      @resultInventory.set 0, ItemPile.fromString(bd.result ? '')
    else
      bd = {burn:@burnInventory.get(0)?.toString(), fuel:@fuelInventory.get(0)?.toString(), result:@resultInventory.get(0)?.toString()}
      @blockdata.set x, y, z, bd

    @activeBlockdata = bd
    console.log('load bd',x,y,z,JSON.stringify(@activeBlockdata))

  updateBlockdata: () ->
    console.log "burn=#{@burnInventory}, fuel=#{@fuelInventory}, result=#{@resultInventory}"

    return if not @activeBlockdata?
    @activeBlockdata.burn = @burnInventory.get(0)?.toString()
    @activeBlockdata.fuel = @fuelInventory.get(0)?.toString()
    @activeBlockdata.result = @resultInventory.get(0)?.toString()
    console.log('update bd',JSON.stringify(@activeBlockdata))

  open: (target) ->
    [x, y, z] = target.voxel
    @loadBlockdata x, y, z

    super()

  close: () ->
    delete @activeBlockdata
    @burnInventory.clear()
    @fuelInventory.clear()
    @resultInventory.clear()
    super()


